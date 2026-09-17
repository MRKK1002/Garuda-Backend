// Purchase Invoice controller. Creating a purchase brings stock IN to the chosen
// warehouse (increments Inventory.available + writes an inward StockLedger row) and
// assigns a clean PUR-0001 serial.
const Purchase = require("../models/Purchase");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Customer = require("../models/Customer");
const Showroom = require("../models/Showroom");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Next purchase invoice serial, starting from 1: PUR-0001, PUR-0002, ...
async function nextPurchaseNumber() {
  const seq = await Counter.nextSeq("purchase");
  return `PUR-${String(seq).padStart(4, "0")}`;
}

// Receive purchased stock into a warehouse: for each line, bump Inventory.available
// for (product, warehouse) and record an inward ledger row.
async function receiveStock(purchase, userId) {
  for (const it of purchase.items) {
    if (!it.product || !it.quantity) continue;
    let inv = await Inventory.findOne({ product: it.product, showroom: purchase.warehouse });
    if (!inv) inv = await Inventory.create({ product: it.product, showroom: purchase.warehouse });
    inv.available += Number(it.quantity) || 0;
    await inv.save();
    await StockLedger.create({
      product: it.product,
      showroom: purchase.warehouse,
      type: "inward",
      quantity: Number(it.quantity) || 0,
      balance: inv.available,
      note: `Purchase ${purchase.number}`,
      refType: "Purchase",
      refId: purchase._id,
      createdBy: userId || null,
    });
  }
}

// GET /api/v1/purchases  (list + optional filters)
const list = asyncHandler(async (req, res) => {
  const { supplier, status, q } = req.query;
  const filter = {};
  if (supplier) filter.supplier = supplier;
  if (status) filter.paymentStatus = status;
  if (q && q.trim()) {
    const rx = new RegExp(q.trim(), "i");
    const suppliers = await Customer.find({ name: rx }).select("_id").limit(200).lean();
    const ids = suppliers.map((s) => s._id);
    filter.$or = [{ number: rx }, { originalInvoiceNo: rx }, ...(ids.length ? [{ supplier: { $in: ids } }] : [])];
  }

  const items = await Purchase.find(filter)
    .populate("supplier", "name mobile")
    .populate("warehouse", "name code")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, items });
});

// GET /api/v1/purchases/stats  (totals for the overview cards)
const stats = asyncHandler(async (req, res) => {
  const agg = await Purchase.aggregate([
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: "$grandTotal" },
        totalPaid: { $sum: "$amountPaid" },
      },
    },
  ]);
  const totalPurchases = agg[0]?.totalPurchases || 0;
  const totalPaid = agg[0]?.totalPaid || 0;
  res.json({
    success: true,
    totalPurchases,
    totalPaid,
    totalUnpaid: Math.max(totalPurchases - totalPaid, 0),
  });
});

// GET /api/v1/purchases/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Purchase.findById(req.params.id)
    .populate("supplier", "name mobile email gstin pan address city state pincode")
    .populate("warehouse", "name code city state")
    .populate("items.product", "name sku hsn unit")
    .lean();
  if (!item) throw new ApiError(404, "Purchase invoice not found.");
  res.json({ success: true, item });
});

// POST /api/v1/purchases
const create = asyncHandler(async (req, res) => {
  const { supplier, warehouse, items } = req.body;
  if (!supplier) throw new ApiError(400, "Supplier is required.");
  if (!warehouse) throw new ApiError(400, "Warehouse is required.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Add at least one line item.");
  }

  // Validate the warehouse is a stock-holding location.
  const wh = await Showroom.findById(warehouse).select("_id type").lean();
  if (!wh) throw new ApiError(404, "Warehouse not found.");

  const number = await nextPurchaseNumber();
  const purchase = await Purchase.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });

  // Receive the purchased stock into the warehouse, then mark it received.
  await receiveStock(purchase, req.auth.user._id);
  purchase.stockReceived = true;
  await purchase.save();

  const created = await Purchase.findById(purchase._id)
    .populate("supplier", "name mobile")
    .populate("warehouse", "name code")
    .lean();

  res.status(201).json({ success: true, item: created });
});

module.exports = { list, stats, getOne, create, nextPurchaseNumber };
