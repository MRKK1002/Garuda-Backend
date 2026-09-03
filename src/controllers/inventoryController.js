// Inventory controller. Lists stock (scoped to the user's showrooms, with optional
// showroom filter, search, and low-stock filter), and records inward/adjustment
// movements that update the stock record and append a ledger entry.
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Product = require("../models/Product");
const Showroom = require("../models/Showroom");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

// Find-or-create the stock record for a product+showroom.
async function getOrCreateStock(product, showroom) {
  let stock = await Inventory.findOne({ product, showroom });
  if (!stock) stock = await Inventory.create({ product, showroom });
  return stock;
}

// GET /api/v1/inventory
const list = asyncHandler(async (req, res) => {
  const { showroom, lowStock } = req.query;

  const filter = { ...scopeQuery(req, "showroom") };
  if (showroom) {
    assertShowroomAccess(req, showroom);
    filter.showroom = showroom;
  }

  let items = await Inventory.find(filter)
    .populate("product", "name sku sellingPrice")
    .populate("showroom", "name code")
    .sort({ updatedAt: -1 })
    .lean();

  // Low-stock filter: available at or below the configured threshold.
  if (lowStock === "true") {
    items = items.filter((i) => i.available <= (i.minStock || 0));
  }

  res.json({ success: true, items });
});

// POST /api/v1/inventory/inward  { product, showroom, quantity, note }
const inward = asyncHandler(async (req, res) => {
  const { product, showroom, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!product || !showroom) throw new ApiError(400, "product and showroom are required.");
  if (!qty || qty <= 0) throw new ApiError(400, "quantity must be a positive number.");
  assertShowroomAccess(req, showroom);

  const stock = await getOrCreateStock(product, showroom);
  stock.available += qty;
  await stock.save();

  await StockLedger.create({
    product,
    showroom,
    type: "inward",
    quantity: qty,
    balance: stock.available,
    note,
    createdBy: req.auth.user._id,
  });

  res.status(201).json({ success: true, item: stock });
});

// POST /api/v1/inventory/adjust  { product, showroom, quantity, note }
// quantity is a signed delta (e.g. -3 to correct down). Cannot drive available below 0.
const adjust = asyncHandler(async (req, res) => {
  const { product, showroom, quantity, note } = req.body;
  const delta = Number(quantity);
  if (!product || !showroom) throw new ApiError(400, "product and showroom are required.");
  if (!delta) throw new ApiError(400, "quantity delta is required.");
  assertShowroomAccess(req, showroom);

  const stock = await getOrCreateStock(product, showroom);
  if (stock.available + delta < 0) {
    throw new ApiError(400, "Adjustment would make available stock negative.");
  }
  stock.available += delta;
  await stock.save();

  await StockLedger.create({
    product,
    showroom,
    type: "adjustment",
    quantity: delta,
    balance: stock.available,
    note,
    createdBy: req.auth.user._id,
  });

  res.json({ success: true, item: stock });
});

// POST /api/v1/inventory/damage  { product, showroom, quantity, note }
// Moves stock from available to damaged and logs a ledger entry.
const damage = asyncHandler(async (req, res) => {
  const { product, showroom, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!product || !showroom) throw new ApiError(400, "product and showroom are required.");
  if (!qty || qty <= 0) throw new ApiError(400, "quantity must be a positive number.");
  assertShowroomAccess(req, showroom);

  const stock = await getOrCreateStock(product, showroom);
  if (stock.available < qty) {
    throw new ApiError(400, "Not enough available stock to mark as damaged.");
  }
  stock.available -= qty;
  stock.damaged += qty;
  await stock.save();

  await StockLedger.create({
    product,
    showroom,
    type: "damaged",
    quantity: -qty,
    balance: stock.available,
    note: note || "Damaged stock",
    createdBy: req.auth.user._id,
  });

  res.status(201).json({ success: true, item: stock });
});

// GET /api/v1/inventory/ledger
const ledger = asyncHandler(async (req, res) => {
  const { product, showroom } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (showroom) {
    assertShowroomAccess(req, showroom);
    filter.showroom = showroom;
  }
  if (product) filter.product = product;

  const items = await StockLedger.find(filter)
    .populate("product", "name sku")
    .populate("showroom", "name code")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json({ success: true, items });
});

// POST /api/v1/inventory/bulk-inward
// Body: { rows: [{ sku, showroomCode, quantity, note }] }
// Resolves product by SKU + showroom by code, then adds stock and writes a ledger row.
const bulkInward = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) throw new ApiError(400, "No rows provided.");
  if (rows.length > 5000) throw new ApiError(400, "Too many rows (max 5000).");

  const prodCache = new Map();
  const showroomCache = new Map();

  async function resolveProduct(sku) {
    const key = String(sku).trim().toUpperCase();
    if (prodCache.has(key)) return prodCache.get(key);
    const doc = await Product.findOne({ sku: key });
    prodCache.set(key, doc || null);
    return doc || null;
  }
  async function resolveShowroom(code) {
    const key = String(code).trim().toUpperCase();
    if (showroomCache.has(key)) return showroomCache.get(key);
    const doc = await Showroom.findOne({ code: key });
    showroomCache.set(key, doc || null);
    return doc || null;
  }

  const results = { applied: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const qty = Number(r.quantity);
      if (!r.sku || !r.showroomCode) throw new Error("sku and showroomCode are required");
      if (!qty || qty <= 0) throw new Error("quantity must be positive");

      const product = await resolveProduct(r.sku);
      if (!product) throw new Error(`Unknown SKU: ${r.sku}`);
      const showroom = await resolveShowroom(r.showroomCode);
      if (!showroom) throw new Error(`Unknown showroom code: ${r.showroomCode}`);

      // Enforce showroom access per row.
      assertShowroomAccess(req, showroom._id);

      const stock = await getOrCreateStock(product._id, showroom._id);
      stock.available += qty;
      await stock.save();

      await StockLedger.create({
        product: product._id,
        showroom: showroom._id,
        type: "inward",
        quantity: qty,
        balance: stock.available,
        note: r.note || "Bulk inward",
        createdBy: req.auth.user._id,
      });
      results.applied += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({ row: i + 1, sku: r.sku, message: err.message });
    }
  }

  res.json({ success: true, results });
});

module.exports = { list, inward, adjust, damage, ledger, bulkInward };
