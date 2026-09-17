// Public storefront customer authentication via phone + OTP. In this build the OTP is
// returned in the response ("on-screen OTP") instead of being sent over SMS, so the
// whole flow works without an SMS provider. Swap sendOtp() for a real gateway later.
//
// A storefront signup becomes a CRM Customer (source: "website"), so customers who
// register on the website show up in the admin CRM automatically.
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Showroom = require("../models/Showroom");
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken, verifyToken } = require("../utils/jwt");
const { sendWelcomeEmail, sendOrderConfirmedEmail } = require("../utils/mailer");
const { validateCoupon } = require("./couponController");
const { pickOnlineShowroom, reserveStock } = require("../utils/stockEngine");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// Placeholder "sender". Today it just logs; wire an SMS provider here later.
function sendOtp(mobile, otp) {
  console.log(`[shop-auth] OTP for ${mobile}: ${otp}`);
}

// POST /api/v1/shop/auth/request-otp   body: { mobile }
const requestOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
    throw new ApiError(400, "Enter a valid 10-digit mobile number.");
  }
  const phone = String(mobile).trim();

  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  // Find-or-create the customer, then set the OTP. New records are website customers
  // with an incomplete profile until they finish the register form.
  let customer = await Customer.findOne({ mobile: phone });
  if (!customer) {
    customer = new Customer({
      name: "Guest",
      mobile: phone,
      source: "website",
      profileComplete: false,
    });
  }
  customer.otp = otp;
  customer.otpExpires = otpExpires;
  await customer.save();

  sendOtp(phone, otp);

  // On-screen OTP: return it so the UI can show it (dev/no-SMS mode).
  res.json({
    success: true,
    message: "OTP generated.",
    otp, // remove this field once a real SMS gateway is connected
  });
});

// POST /api/v1/shop/auth/verify-otp   body: { mobile, otp }
const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  const phone = String(mobile || "").trim();

  const customer = await Customer.findOne({ mobile: phone });
  if (!customer || !customer.otp) {
    throw new ApiError(400, "Please request an OTP first.");
  }
  if (customer.otpExpires < new Date()) {
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }
  if (customer.otp !== String(otp).trim()) {
    throw new ApiError(400, "Incorrect OTP.");
  }

  // Clear the OTP after a successful verify.
  customer.otp = undefined;
  customer.otpExpires = undefined;
  await customer.save();

  const token = signToken({ sub: customer._id, type: "customer" });

  res.json({
    success: true,
    token,
    isNew: !customer.profileComplete, // UI shows the register form when true
    customer: publicCustomer(customer),
  });
});

// Auth guard for customer-token routes.
async function requireCustomer(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Not authenticated.");
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session.");
  }
  if (decoded.type !== "customer") throw new ApiError(401, "Invalid session.");
  const customer = await Customer.findById(decoded.sub);
  if (!customer) throw new ApiError(401, "Account not found.");
  return customer;
}

// POST /api/v1/shop/auth/complete-profile  (auth)  body: name, email, address, city, state, pincode, lat, lng
const completeProfile = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  const { name, email, address, city, state, pincode, lat, lng } = req.body;

  if (!name) throw new ApiError(400, "Name is required.");

  customer.name = name;
  if (email !== undefined) customer.email = email;
  if (address !== undefined) customer.address = address;
  if (city !== undefined) customer.city = city;
  if (state !== undefined) customer.state = state;
  if (pincode !== undefined) customer.pincode = pincode;
  if (lat !== undefined) customer.lat = lat;
  if (lng !== undefined) customer.lng = lng;
  customer.profileComplete = true;
  await customer.save();

  // Send welcome email (fire-and-forget — never blocks the response).
  sendWelcomeEmail(customer).catch(() => {});

  res.json({ success: true, customer: publicCustomer(customer) });
});

// GET /api/v1/shop/auth/me  (auth)
const me = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  res.json({ success: true, customer: publicCustomer(customer) });
});

// PUT /api/v1/shop/auth/profile  (auth) - edit profile/address from My Account
const updateProfile = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  const { name, email, address, city, state, pincode, lat, lng } = req.body;

  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, "Name cannot be empty.");
    customer.name = name;
  }
  if (email !== undefined) customer.email = email;
  if (address !== undefined) customer.address = address;
  if (city !== undefined) customer.city = city;
  if (state !== undefined) customer.state = state;
  if (pincode !== undefined) customer.pincode = pincode;
  if (lat !== undefined) customer.lat = lat;
  if (lng !== undefined) customer.lng = lng;
  await customer.save();

  res.json({ success: true, customer: publicCustomer(customer) });
});

// GET /api/v1/shop/auth/orders  (auth) - this customer's order history
const myOrders = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  const orders = await Order.find({ customer: customer._id })
    .select("number items grandTotal status paymentStatus createdAt")
    .populate("items.product", "name images")
    .sort({ createdAt: -1 })
    .lean();

  // Attach a thumbnail (first product's first image) + item names for the UI.
  const withThumbs = orders.map((o) => {
    const first = o.items?.[0]?.product;
    const thumb = first?.images?.[0] || null;
    return {
      ...o,
      thumb,
      itemNames: (o.items || []).map((it) => it.product?.name || it.name).filter(Boolean),
    };
  });

  res.json({ success: true, orders: withThumbs });
});

// Only expose safe customer fields to the storefront.
function publicCustomer(c) {
  return {
    id: c._id,
    name: c.name,
    mobile: c.mobile,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    profileComplete: c.profileComplete,
  };
}

// POST /api/v1/shop/auth/checkout  (auth)
// Places an online order for the logged-in customer. Body: { items:[{product, quantity}],
// deliveryAddress, paymentMethod }. Prices are taken from the DB (never trusted from the
// client). Payment is a dummy "paid" record until a real gateway is integrated.
const checkout = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  const { items, deliveryAddress, paymentMethod = "online", couponCode } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Your cart is empty.");
  }
  // Build order items from real product data (authoritative pricing).
  const orderItems = [];
  for (const line of items) {
    const product = await Product.findOne({ _id: line.product, status: "active" })
      .populate("category", "_id")
      .lean();
    if (!product) continue;
    const qty = Math.max(1, Number(line.quantity) || 1);
    orderItems.push({
      product: product._id,
      name: product.name,
      quantity: qty,
      price: product.sellingPrice || product.mrp || 0,
      discount: 0,
      gst: product.gst || 0,
      _categoryId: product.category?._id, // temp field for coupon check
    });
  }
  if (orderItems.length === 0) throw new ApiError(400, "No valid products in the cart.");

  // Pick the fulfilling showroom: nearest store to the customer that has full stock.
  // If none has full stock, we still create the order but flag it for manual handling.
  const { showroomId, hasStock } = await pickOnlineShowroom(customer, orderItems);
  if (!showroomId) {
    throw new ApiError(400, "No showroom available to fulfil online orders. Please create a showroom in the admin.");
  }
  const showroom = { _id: showroomId };
  // Compute cart total before coupon.
  const cartTotal = orderItems.reduce((s, it) => s + it.price * it.quantity, 0);
  // Validate coupon if provided.
  let couponDiscount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    const categoryIds = [...new Set(orderItems.map((it) => String(it._categoryId)).filter(Boolean))];
    const { coupon, discountAmount } = await validateCoupon(couponCode, cartTotal, categoryIds);
    couponDiscount = discountAmount;
    appliedCouponCode = coupon.code;
    // Increment usage count.
    await coupon.constructor.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
  }
  // Strip temp fields before saving.
  const cleanItems = orderItems.map(({ _categoryId, ...rest }) => rest);
  // Invoice number: same global serial as admin-created invoices (INV-0001, ...)
  // so online and in-store orders share one gap-free sequence.
  const Counter = require("../models/Counter");
  const invSeq = await Counter.nextSeq("invoice");
  const number = `INV-${String(invSeq).padStart(4, "0")}`;

  const order = await Order.create({
    number,
    customer: customer._id,
    showroom: showroom._id,
    channel: "website",
    items: cleanItems,
    deliveryAddress: deliveryAddress || {
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    },
    paymentMethod,
    coupon: appliedCouponCode,
    couponDiscount,
    status: "confirmed",
    paymentStatus: "paid",
    // If the chosen store had full stock, reserve it below and mark allocated.
    // Otherwise the order is confirmed+paid but needs staff to source stock.
    stockAllocated: hasStock,
    fulfillmentStatus: hasStock ? "allocated" : "pending_assignment",
  });
  order.amountPaid = order.grandTotal;
  await order.save();
  // Reserve stock at the chosen showroom (available -> reserved) when it's in stock.
  if (hasStock) {
    try {
      await reserveStock(order, null);
    } catch (err) {
      // Race: stock ran out between check and reserve — flag for manual handling.
      order.stockAllocated = false;
      order.fulfillmentStatus = "pending_assignment";
      await order.save();
    }
  }
  await Payment.create({
    order: order._id,
    customer: customer._id,
    showroom: showroom._id,
    amount: order.grandTotal,
    mode: "upi",
    status: "success",
    reference: `ONLINE-DUMMY-${Date.now()}`,
  });
  sendOrderConfirmedEmail(order, customer).catch(() => {});
  res.status(201).json({
    success: true,
    orderId: order._id,
    number: order.number,
    total: order.grandTotal,
    couponDiscount,
    coupon: appliedCouponCode,
    fulfillmentStatus: order.fulfillmentStatus,
  });
});
module.exports = { requestOtp, verifyOtp, completeProfile, me, updateProfile, myOrders, checkout, requireCustomer };
