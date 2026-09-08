// Public storefront (e-commerce) controller. These endpoints are UNAUTHENTICATED and
// read-only for catalogue browsing, plus a public enquiry endpoint that creates a
// CRM lead. Only active products/categories are exposed. Nothing here mutates the
// catalogue or reveals staff-only data.
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Showroom = require("../models/Showroom");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Banner = require("../models/Banner");
const Testimonial = require("../models/Testimonial");
const Review = require("../models/Review");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/shop/products
// Filters: q (search), category, brand, minPrice, maxPrice, featured, bestseller,
// newArrival. Sort: newest (default), price_asc, price_desc. Pagination: page, limit.
const listProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    featured,
    bestseller,
    newArrival,
    sort = "newest",
    page = 1,
    limit = 24,
  } = req.query;

  // Only active products are ever shown to the public.
  const filter = { status: "active" };

  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (featured === "true") filter.isFeatured = true;
  if (bestseller === "true") filter.isBestseller = true;
  if (newArrival === "true") filter.isNewArrival = true;

  // Price range on sellingPrice.
  if (minPrice || maxPrice) {
    filter.sellingPrice = {};
    if (minPrice) filter.sellingPrice.$gte = Number(minPrice);
    if (maxPrice) filter.sellingPrice.$lte = Number(maxPrice);
  }

  // Search by name / model / code (regex so partial matches work without a text index).
  if (q) {
    const rx = new RegExp(q, "i");
    filter.$or = [{ name: rx }, { model: rx }, { productCode: rx }];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    price_asc: { sellingPrice: 1 },
    price_desc: { sellingPrice: -1 },
  };
  const sortBy = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, Number(page));
  const perPage = Math.min(60, Math.max(1, Number(limit)));

  // If a minimum rating is requested, first find product ids whose average rating
  // meets it, then constrain the product filter to those ids.
  if (minRating) {
    const min = Number(minRating);
    const rated = await Review.aggregate([
      { $group: { _id: "$product", avg: { $avg: "$rating" } } },
      { $match: { avg: { $gte: min } } },
    ]);
    filter._id = { $in: rated.map((r) => r._id) };
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name")
      .populate("brand", "name")
      .sort(sortBy)
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    items,
    total,
    page: pageNum,
    limit: perPage,
    pages: Math.ceil(total / perPage),
  });
});

// GET /api/v1/shop/products/:id  (product detail + related products)
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, status: "active" })
    .populate("category", "name parent")
    .populate("brand", "name")
    .lean();

  if (!product) throw new ApiError(404, "Product not found.");

  // Related = other active products in the same category.
  const catId = product.category?._id || product.category;

  // Related = other active products in the same category first.
  let related = await Product.find({
    _id: { $ne: product._id },
    category: catId,
    status: "active",
  })
    .populate("brand", "name")
    .limit(8)
    .lean();

  // Fallback: if the category has few/no other products, fill with other active
  // products so the "Related Products" row isn't empty.
  if (related.length < 4) {
    const excludeIds = [product._id, ...related.map((r) => r._id)];
    const fillers = await Product.find({
      _id: { $nin: excludeIds },
      status: "active",
    })
      .populate("brand", "name")
      .sort({ createdAt: -1 })
      .limit(8 - related.length)
      .lean();
    related = [...related, ...fillers];
  }

  res.json({ success: true, item: product, related });
});

// GET /api/v1/shop/categories  (active categories, for browsing, with product counts)
const listCategories = asyncHandler(async (req, res) => {
  const items = await Category.find({ status: "active" }).sort({ name: 1 }).lean();

  // Count active products per category in one aggregation, then attach to each category.
  const counts = await Product.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const countMap = counts.reduce((m, c) => {
    if (c._id) m[String(c._id)] = c.count;
    return m;
  }, {});

  // A top-level category's count includes its sub-categories' products.
  const withCounts = items.map((c) => {
    let count = countMap[String(c._id)] || 0;
    if (!c.parent) {
      items
        .filter((sub) => sub.parent && String(sub.parent) === String(c._id))
        .forEach((sub) => {
          count += countMap[String(sub._id)] || 0;
        });
    }
    return { ...c, productCount: count };
  });

  res.json({ success: true, items: withCounts });
});

// GET /api/v1/shop/brands
const listBrands = asyncHandler(async (req, res) => {
  const items = await Brand.find().sort({ name: 1 }).lean();
  res.json({ success: true, items });
});

// GET /api/v1/shop/showrooms  (store locator - active showrooms, not warehouses)
// A missing `type` is treated as a showroom (older records), so only warehouses are
// excluded.
const listShowrooms = asyncHandler(async (req, res) => {
  const items = await Showroom.find({ type: { $ne: "warehouse" }, status: "active" })
    .select("name code address city state pincode phone email")
    .sort({ city: 1 })
    .lean();
  res.json({ success: true, items });
});

// POST /api/v1/shop/enquiry
// Public enquiry from the storefront. Finds-or-creates a Customer (by mobile) with
// source "website" and creates a website Lead so it flows into the CRM pipeline.
const submitEnquiry = asyncHandler(async (req, res) => {
  const { name, mobile, email, product, message } = req.body;

  if (!name || !mobile) {
    throw new ApiError(400, "Name and mobile are required.");
  }

  // Reuse an existing customer with this mobile, or create a new website customer.
  let customer = await Customer.findOne({ mobile });
  if (!customer) {
    customer = await Customer.create({
      name,
      mobile,
      email,
      source: "website",
      segment: "new",
    });
  }

  const lead = await Lead.create({
    customer: customer._id,
    product: product || undefined,
    requirement: message,
    source: "website",
    stage: "new",
  });

  res.status(201).json({
    success: true,
    message: "Thank you for your enquiry. Our team will contact you shortly.",
    leadId: lead._id,
  });
});

// GET /api/v1/shop/banners  (active home banners, ordered)
const listBanners = asyncHandler(async (req, res) => {
  const items = await Banner.find({ status: "active" })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/shop/testimonials  (active testimonials, ordered)
const listTestimonials = asyncHandler(async (req, res) => {
  const items = await Testimonial.find({ status: "active" })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

module.exports = {
  listProducts,
  getProduct,
  listCategories,
  listBrands,
  listShowrooms,
  listBanners,
  listTestimonials,
  submitEnquiry,
};
