// Coupon controller.
// Admin routes: list, getOne, create, update, remove.
// Public route:  POST /api/v1/shop/coupons/validate  — validates a code against a cart.
const Coupon = require("../models/Coupon");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// ── helpers ───────────────────────────────────────────────────────────────────

// Calculate the discount amount for a coupon against a cart total.
// cartCategoryIds — array of category ObjectId strings in the cart.
function calcDiscount(coupon, cartTotal, cartCategoryIds = []) {
  // Category restriction check.
  if (coupon.categories && coupon.categories.length > 0) {
    const allowed = coupon.categories.map((c) => String(c._id || c));
    const cartCats = cartCategoryIds.map(String);
    const hasMatch = cartCats.some((id) => allowed.includes(id));
    if (!hasMatch) return 0;
  }

  let discount = 0;
  if (coupon.type === "flat") {
    discount = coupon.value;
  } else {
    discount = Math.round((cartTotal * coupon.value) / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  }
  // Discount can never exceed the cart total.
  return Math.min(discount, cartTotal);
}

// Validate a coupon code — throws ApiError with a user-friendly message if invalid.
async function validateCoupon(code, cartTotal, cartCategoryIds = []) {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon) throw new ApiError(404, "Invalid coupon code.");
  if (coupon.status !== "active") throw new ApiError(400, "This coupon is no longer active.");

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) {
    throw new ApiError(400, "This coupon is not valid yet.");
  }
  if (coupon.expiryDate && coupon.expiryDate < now) {
    throw new ApiError(400, "This coupon has expired.");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, "This coupon has reached its usage limit.");
  }
  if (cartTotal < coupon.minOrderAmount) {
    throw new ApiError(
      400,
      `This coupon requires a minimum order of ₹${coupon.minOrderAmount.toLocaleString("en-IN")}.`
    );
  }

  const discountAmount = calcDiscount(coupon, cartTotal, cartCategoryIds);
  if (discountAmount === 0 && coupon.categories.length > 0) {
    throw new ApiError(400, "This coupon is not applicable for the items in your cart.");
  }

  return { coupon, discountAmount };
}

// ── Public: validate ──────────────────────────────────────────────────────────

// POST /api/v1/shop/coupons/validate
// body: { code, cartTotal, categoryIds? }
const validate = asyncHandler(async (req, res) => {
  const { code, cartTotal, categoryIds = [] } = req.body;
  if (!code) throw new ApiError(400, "Please enter a coupon code.");
  if (!cartTotal || cartTotal <= 0) throw new ApiError(400, "Invalid cart total.");

  const { coupon, discountAmount } = await validateCoupon(
    code,
    Number(cartTotal),
    categoryIds
  );

  res.json({
    success: true,
    code: coupon.code,
    description: coupon.description || "",
    type: coupon.type,
    value: coupon.value,
    discountAmount,
    finalTotal: Math.max(Number(cartTotal) - discountAmount, 0),
  });
});

// ── Admin CRUD ────────────────────────────────────────────────────────────────

// GET /api/v1/coupons
const list = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.code = { $regex: q.trim(), $options: "i" };

  const items = await Coupon.find(filter)
    .populate("categories", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/coupons/:id
const getOne = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id)
    .populate("categories", "name")
    .lean();
  if (!coupon) throw new ApiError(404, "Coupon not found.");
  res.json({ success: true, item: coupon });
});

// POST /api/v1/coupons
const create = asyncHandler(async (req, res) => {
  const data = { ...req.body, createdBy: req.auth.user._id };
  if (data.code) data.code = String(data.code).toUpperCase().trim();
  const coupon = await Coupon.create(data);
  res.status(201).json({ success: true, item: coupon });
});

// PUT /api/v1/coupons/:id
const update = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.code) data.code = String(data.code).toUpperCase().trim();
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  }).populate("categories", "name");
  if (!coupon) throw new ApiError(404, "Coupon not found.");
  res.json({ success: true, item: coupon });
});

// DELETE /api/v1/coupons/:id
const remove = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, "Coupon not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, remove, validate, validateCoupon, calcDiscount };
