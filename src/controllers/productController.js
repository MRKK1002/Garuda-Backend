// Product CRUD. List supports search (?q=), and filters by category, brand, status.
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/products
const list = asyncHandler(async (req, res) => {
  const { q, category, brand, status } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { sku: new RegExp(q, "i") },
      { model: new RegExp(q, "i") },
      { productCode: new RegExp(q, "i") },
    ];
  }

  const items = await Product.find(filter)
    .populate("category", "name")
    .populate("brand", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/products/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Product.findById(req.params.id)
    .populate("category", "name")
    .populate("brand", "name")
    .lean();
  if (!item) throw new ApiError(404, "Product not found.");
  res.json({ success: true, item });
});

const Inventory = require("../models/Inventory");
const Showroom = require("../models/Showroom");

// POST /api/v1/products
const create = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  // Resolve or default Category
  if (!payload.category) {
    let cat = await Category.findOne({ name: "General Appliances" });
    if (!cat) cat = await Category.create({ name: "General Appliances", slug: "general-appliances" });
    payload.category = cat._id;
  } else if (typeof payload.category === "string" && !payload.category.match(/^[0-9a-fA-F]{24}$/)) {
    let cat = await Category.findOne({ name: new RegExp(`^${payload.category.trim()}$`, "i") });
    if (!cat) cat = await Category.create({ name: payload.category.trim(), slug: payload.category.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    payload.category = cat._id;
  }

  // Resolve or default Brand
  if (!payload.brand) {
    let br = await Brand.findOne({ name: "Garuda / General" });
    if (!br) br = await Brand.create({ name: "Garuda / General", slug: "garuda-general" });
    payload.brand = br._id;
  } else if (typeof payload.brand === "string" && !payload.brand.match(/^[0-9a-fA-F]{24}$/)) {
    let br = await Brand.findOne({ name: new RegExp(`^${payload.brand.trim()}$`, "i") });
    if (!br) br = await Brand.create({ name: payload.brand.trim(), slug: payload.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-") });
    payload.brand = br._id;
  }

  // Auto-generate SKU if missing
  if (!payload.sku) {
    const prefix = (payload.name || "ITM").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
    payload.sku = `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  // Selling price default
  if (!payload.sellingPrice && payload.salesPrice) {
    payload.sellingPrice = Number(payload.salesPrice) || 0;
  }

  const item = await Product.create(payload);

  // Initialize stock inventory if openingStock > 0
  const openingStock = Number(payload.openingStock) || 0;
  if (openingStock > 0 || payload.showroom) {
    let showroomId = payload.showroom || payload.godown;
    if (!showroomId) {
      const defaultShowroom = await Showroom.findOne({ status: "active" });
      if (defaultShowroom) showroomId = defaultShowroom._id;
    }
    if (showroomId) {
      await Inventory.findOneAndUpdate(
        { product: item._id, showroom: showroomId },
        {
          available: openingStock,
          minStock: Number(payload.lowStockAlert) || 0,
        },
        { upsert: true, new: true }
      );
    }
  }

  const created = await Product.findById(item._id)
    .populate("category", "name")
    .populate("brand", "name")
    .lean();
  res.status(201).json({ success: true, item: created });
});

// PUT /api/v1/products/:id
const update = asyncHandler(async (req, res) => {
  // If these fields are present in the body they must not be blank (brand/category
  // are mandatory). Absent fields are left unchanged.
  if ("brand" in req.body && !req.body.brand) throw new ApiError(400, "Brand is required.");
  if ("category" in req.body && !req.body.category) throw new ApiError(400, "Category is required.");
  const item = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })
    .populate("category", "name")
    .populate("brand", "name");
  if (!item) throw new ApiError(404, "Product not found.");
  res.json({ success: true, item });
});

// DELETE /api/v1/products/:id
const remove = asyncHandler(async (req, res) => {
  const item = await Product.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Product not found.");
  res.json({ success: true });
});

// POST /api/v1/products/bulk
// Body: { rows: [{ name, sku, model, productCode, category, brand, mrp, sellingPrice,
//                  discount, gst, hsn }] }
// category/brand are names (created on the fly if missing). Upsert by SKU.
const bulkUpsert = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) throw new ApiError(400, "No rows provided.");
  if (rows.length > 2000) throw new ApiError(400, "Too many rows (max 2000).");

  // Cache category/brand lookups by name to avoid repeated queries.
  const catCache = new Map();
  const brandCache = new Map();

  async function resolveCategory(name) {
    if (!name) return undefined;
    const key = name.trim().toLowerCase();
    if (catCache.has(key)) return catCache.get(key);
    let doc = await Category.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
    if (!doc) doc = await Category.create({ name: name.trim() });
    catCache.set(key, doc._id);
    return doc._id;
  }
  async function resolveBrand(name) {
    if (!name) return undefined;
    const key = name.trim().toLowerCase();
    if (brandCache.has(key)) return brandCache.get(key);
    let doc = await Brand.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
    if (!doc) doc = await Brand.create({ name: name.trim() });
    brandCache.set(key, doc._id);
    return doc._id;
  }

  const results = { created: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || !r.sku) throw new Error("name and sku are required");
      const payload = {
        name: r.name,
        model: r.model,
        productCode: r.productCode,
        mrp: Number(r.mrp) || 0,
        sellingPrice: Number(r.sellingPrice) || 0,
        discount: Number(r.discount) || 0,
        gst: Number(r.gst) || 0,
        hsn: r.hsn,
      };
      if (r.category) payload.category = await resolveCategory(r.category);
      if (r.brand) payload.brand = await resolveBrand(r.brand);

      const sku = String(r.sku).trim().toUpperCase();
      const existing = await Product.findOne({ sku });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        results.updated += 1;
      } else {
        await Product.create({ ...payload, sku });
        results.created += 1;
      }
    } catch (err) {
      results.failed += 1;
      results.errors.push({ row: i + 1, sku: r.sku, message: err.message });
    }
  }

  res.json({ success: true, results });
});

// POST /api/v1/products/upload  (multipart form field: "images")
// Returns the public URLs of the uploaded files so the client can attach them to a
// product's images array.
const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) throw new ApiError(400, "No files uploaded.");
  const urls = files.map((f) => `/uploads/${f.filename}`);
  res.status(201).json({ success: true, urls });
});

module.exports = { list, getOne, create, update, remove, bulkUpsert, uploadImages };
