// Order controller. Creates orders (optionally from a quotation), lists them (scoped),
// and drives the lifecycle with stock effects:
//   confirm:  reserve stock at the showroom (available -> reserved), mark stockAllocated
//   deliver:  convert reserved -> sold
//   cancel:   release any reserved stock back to available
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Quotation = require("../models/Quotation");
const Payment = require("../models/Payment");
const Delivery = require("../models/Delivery");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");
const { sendOrderConfirmedEmail, sendOrderDeliveredEmail } = require("../utils/mailer");
const { reserveStock, fulfillStock, releaseStock } = require("../utils/stockEngine");

// Invoice number: a clean global serial starting from 1 (INV-0001, INV-0002, ...)
// via the atomic Counter so numbers never collide or skip.
async function nextOrderNumber() {
  const Counter = require("../models/Counter");
  const seq = await Counter.nextSeq("invoice");
  return `INV-${String(seq).padStart(4, "0")}`;
}

// Build the Mongo filter for order listing/stats from the request query.
// Supports: showroom scope, status, customer, channel, ?q= (invoice# or customer
// name), and ?from=&to= date range on createdAt.
async function buildOrderFilter(req) {
  const { status, customer, showroom, channel, q, from, to } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  if (channel) filter.channel = channel;
  if (showroom) {
    assertShowroomAccess(req, showroom);
    filter.showroom = showroom;
  }

  // Date range on createdAt.
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Text search: invoice number OR customer name (resolve matching customer ids).
  if (q && q.trim()) {
    const term = q.trim();
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchCustomers = await require("../models/Customer")
      .find({ name: rx }).select("_id").limit(200).lean();
    const custIds = matchCustomers.map((c) => c._id);
    filter.$or = [{ number: rx }, ...(custIds.length ? [{ customer: { $in: custIds } }] : [])];
  }

  return filter;
}

// GET /api/v1/orders  — paginated, filtered list.
// Query: page, limit, status, customer, showroom, channel, q, from, to
const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = await buildOrderFilter(req);

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name mobile")
      .populate("showroom", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/v1/orders/stats  — server-side totals for the stat cards (respects the
// same filters as the list, minus pagination).
const stats = asyncHandler(async (req, res) => {
  const filter = await buildOrderFilter(req);

  const [agg] = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        // Non-cancelled totals
        totalSales: {
          $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$grandTotal", 0] },
        },
        paid: {
          $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$amountPaid", 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, "$grandTotal", 0] },
        },
      },
    },
  ]);

  const totalSales = agg?.totalSales || 0;
  const paid = agg?.paid || 0;
  const cancelled = agg?.cancelled || 0;
  const unpaid = Math.max(totalSales - paid, 0);

  res.json({ success: true, stats: { totalSales, paid, unpaid, cancelled } });
});

// GET /api/v1/orders/:id  (with related payments + deliveries for the detail page)
const getOne = asyncHandler(async (req, res) => {
  const item = await Order.findById(req.params.id)
    .populate("customer", "name mobile email address city state pincode gstin pan shippingAddress")
    .populate("showroom", "name code address city state pincode gstin phone")
    .populate("items.product", "name sku hsn gst unit")
    .lean();
  if (!item) throw new ApiError(404, "Order not found.");

  // Store-wise access: a scoped user can only open orders from their showrooms.
  assertShowroomAccess(req, item.showroom?._id || item.showroom);

  const [payments, deliveries] = await Promise.all([
    Payment.find({ order: item._id }).sort({ createdAt: -1 }).lean(),
    Delivery.find({ order: item._id }).sort({ createdAt: -1 }).lean(),
  ]);

  res.json({ success: true, item, related: { payments, deliveries } });
});

// POST /api/v1/orders
const create = asyncHandler(async (req, res) => {
  const { customer, showroom, items, salesperson, quotation } = req.body;
  if (!customer || !showroom) throw new ApiError(400, "customer and showroom are required.");
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, "At least one item is required.");
  assertShowroomAccess(req, showroom);

  const number = await nextOrderNumber();
  const order = await Order.create({
    number,
    customer,
    showroom,
    salesperson,
    quotation,
    items,
    createdBy: req.auth.user._id,
  });

  // If created from a quotation, mark it converted.
  if (quotation) {
    await Quotation.findByIdAndUpdate(quotation, { status: "converted" });
  }

  const created = await Order.findById(order._id)
    .populate("customer", "name mobile email")
    .populate("showroom", "name code")
    .lean();

  // Send order confirmation email to the customer (fire-and-forget).
  sendOrderConfirmedEmail(created, created.customer).catch(() => {});

  res.status(201).json({ success: true, item: created });
});

// PATCH /api/v1/orders/:id/status  { action }
// action: confirm | process | dispatch | deliver | cancel
const changeStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found.");
  assertShowroomAccess(req, order.showroom);

  const transitions = {
    confirm: { from: "new", to: "confirmed" },
    process: { from: "confirmed", to: "processing" },
    dispatch: { from: "processing", to: "dispatched" },
    deliver: { from: "dispatched", to: "delivered" },
    cancel: { from: ["new", "confirmed", "processing"], to: "cancelled" },
  };
  const rule = transitions[action];
  if (!rule) throw new ApiError(400, `Unknown action: ${action}`);
  const allowedFrom = Array.isArray(rule.from) ? rule.from : [rule.from];
  if (!allowedFrom.includes(order.status)) {
    throw new ApiError(400, `Cannot ${action} an order that is '${order.status}'.`);
  }

  // --- Stock effects (shared engine so CRM + online behave identically) ---
  if (action === "confirm" && !order.stockAllocated) {
    try {
      await reserveStock(order, req.auth.user._id);
    } catch (err) {
      throw new ApiError(err.statusCode || 400, err.message);
    }
    order.stockAllocated = true;
    order.fulfillmentStatus = "allocated";
  }

  if (action === "deliver") {
    await fulfillStock(order, req.auth.user._id);
  }

  if (action === "cancel" && order.stockAllocated) {
    await releaseStock(order, req.auth.user._id);
    order.stockAllocated = false;
  }

  order.status = rule.to;
  await order.save();

  // Send delivery confirmation email when order is marked delivered.
  if (action === "deliver") {
    const populated = await Order.findById(order._id)
      .populate("customer", "name mobile email")
      .lean();
    sendOrderDeliveredEmail(populated, populated.customer).catch(() => {});
  }

  res.json({ success: true, item: order });
});

module.exports = { list, stats, getOne, create, changeStatus };
