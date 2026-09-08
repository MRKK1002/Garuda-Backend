// Product reviews for the storefront. Reading is public. Writing requires a logged-in
// customer who has PURCHASED the product (an order of theirs contains it). One review
// per customer per product. Supports a star rating, text, and images.
const Review = require("../models/Review");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { requireCustomer } = require("./shopAuthController");

// GET /api/v1/shop/products/:id/reviews  (public)
const listReviews = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  const reviews = await Review.find({ product: productId })
    .sort({ createdAt: -1 })
    .lean();

  const count = reviews.length;
  const average =
    count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // If a customer is logged in, tell the UI whether they may review (purchased +
  // haven't reviewed yet).
  let canReview = false;
  let alreadyReviewed = false;
  try {
    const customer = await requireCustomer(req);
    alreadyReviewed = reviews.some((r) => String(r.customer) === String(customer._id));
    const purchased = await hasPurchased(customer._id, productId);
    canReview = purchased && !alreadyReviewed;
  } catch {
    // Not logged in - canReview stays false.
  }

  res.json({
    success: true,
    reviews,
    count,
    average: Math.round(average * 10) / 10,
    canReview,
    alreadyReviewed,
  });
});

// POST /api/v1/shop/products/:id/reviews  (customer auth, verified purchase)
const createReview = asyncHandler(async (req, res) => {
  const customer = await requireCustomer(req);
  const productId = req.params.id;
  const { rating, text, images } = req.body;

  const r = Number(rating);
  if (!r || r < 1 || r > 5) throw new ApiError(400, "Please give a rating between 1 and 5.");

  const purchased = await hasPurchased(customer._id, productId);
  if (!purchased) {
    throw new ApiError(403, "Only customers who purchased this product can review it.");
  }

  const existing = await Review.findOne({ product: productId, customer: customer._id });
  if (existing) throw new ApiError(400, "You have already reviewed this product.");

  const review = await Review.create({
    product: productId,
    customer: customer._id,
    customerName: customer.name,
    rating: r,
    text,
    images: Array.isArray(images) ? images : [],
    verifiedPurchase: true,
  });

  res.status(201).json({ success: true, review });
});

// POST /api/v1/shop/reviews/upload  (customer auth) - single image
const uploadReviewImage = asyncHandler(async (req, res) => {
  await requireCustomer(req); // must be logged in
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

// True if the customer has any order containing this product.
async function hasPurchased(customerId, productId) {
  const order = await Order.findOne({
    customer: customerId,
    "items.product": productId,
  }).select("_id");
  return Boolean(order);
}

module.exports = { listReviews, createReview, uploadReviewImage };
