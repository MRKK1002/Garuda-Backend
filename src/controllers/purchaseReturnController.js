// Purchase Return controller. Creating a return REMOVES the returned quantities from
// the warehouse stock (opposite of a purchase) and writes outward StockLedger rows.
const PurchaseReturn = require("../models/PurchaseReturn");
const Purchase = require("../models/Purchase");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Customer = require("../models/Customer");
const Showroom = require("../models/Showroom");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

async function nextReturnNumber() {
  const seq = await Counter.nextSeq("purchase_return");
  return `PRET-${String(seq).padStart(4, "0")}`;
}

// Remove returned stock from the warehouse: decrement Inventory.available (not below
// 0) and record an outward ledger row.
async function removeStock(ret, userId) {
  for (const it of ret.items) {
    if (!it.product || !it.quantity) continue;
    let inv = await Inventory.findOne({ product: it.product, showroom: ret.warehouse });
    if (!inv) inv = await Inventory.create({ product: it.product, showroom: ret.warehouse });
    inv.available = Math.max((inv.available || 0) - (Number(it.quantity) || 0), 0);
    await inv.save();
    await StockLedger.create({
      product: it.product,
      showroom: ret.warehouse,
      type: "outward",
      quantity: -(Number(it.quantity) || 0),
      balance: inv.available,
      note: `Purchase Return ${ret.number}`,
      refType: "PurchaseReturn",
      refId: ret._id,
      createdBy: userId || null,
    });
  }
}

// GET /api/v1/purchase-returns
const list = asyncHandler(async (req, res) => {
  const { supplier, q } = req.query;
  const filter = {};
  if (supplier) filter.supplier = supplier;
  if (q && q.trim()) {
    const rx = new RegExp(q.trim(), "i");
    const suppliers = await Customer.find({ name: rx }).select("_id").limit(200).lean();
    const ids = suppliers.map((s) => s._id);
    filter.$or = [{ number: rx }, ...(ids.length ? [{ supplier: { $in: ids } }] : [])];
  }
  const items = await PurchaseReturn.find(filter)
    .populate("supplier", "name mobile")
    .populate("warehouse", "name code")
    .populate("purchase", "number")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/purchase-returns/next-number  (peek, no consume)
const nextNumber = asyncHandler(async (req, res) => {
  const seq = await Counter.peekSeq("purchase_return");
  res.json({ success: true, number: `PRET-${String(seq).padStart(4, "0")}` });
});

// GET /api/v1/purchase-returns/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await PurchaseReturn.findById(req.params.id)
    .populate("supplier", "name mobile email gstin pan address city state pincode")
    .populate("warehouse", "name code city state")
    .populate("purchase", "number")
    .populate("items.product", "name sku hsn unit")
    .lean();
  if (!item) throw new ApiError(404, "Purchase return not found.");
  res.json({ success: true, item });
});

// POST /api/v1/purchase-returns
const create = asyncHandler(async (req, res) => {
  const { supplier, warehouse, items } = req.body;
  if (!supplier) throw new ApiError(400, "Supplier is required.");
  if (!warehouse) throw new ApiError(400, "Warehouse is required.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Add at least one line item.");
  }

  const wh = await Showroom.findById(warehouse).select("_id").lean();
  if (!wh) throw new ApiError(404, "Warehouse not found.");

  const number = await nextReturnNumber();
  const ret = await PurchaseReturn.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });

  await removeStock(ret, req.auth.user._id);
  ret.stockRemoved = true;
  await ret.save();

  const created = await PurchaseReturn.findById(ret._id)
    .populate("supplier", "name mobile")
    .populate("warehouse", "name code")
    .populate("purchase", "number")
    .lean();

  res.status(201).json({ success: true, item: created });
});

module.exports = { list, nextNumber, getOne, create };
