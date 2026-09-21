// Sales Return controller. Creating a return ADDS the returned quantities BACK to the
// showroom stock (opposite of a sale) and writes inward StockLedger rows.
const SalesReturn = require("../models/SalesReturn");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Customer = require("../models/Customer");
const Showroom = require("../models/Showroom");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

async function nextReturnNumber() {
  const seq = await Counter.nextSeq("sales_return");
  return `SRET-${String(seq).padStart(4, "0")}`;
}

// Restore returned stock into the showroom: increment Inventory.available and record
// an inward ledger row.
async function restoreStock(ret, userId) {
  for (const it of ret.items) {
    if (!it.product || !it.quantity) continue;
    let inv = await Inventory.findOne({ product: it.product, showroom: ret.showroom });
    if (!inv) inv = await Inventory.create({ product: it.product, showroom: ret.showroom });
    inv.available += Number(it.quantity) || 0;
    await inv.save();
    await StockLedger.create({
      product: it.product,
      showroom: ret.showroom,
      type: "inward",
      quantity: Number(it.quantity) || 0,
      balance: inv.available,
      note: `Sales Return ${ret.number}`,
      refType: "SalesReturn",
      refId: ret._id,
      createdBy: userId || null,
    });
  }
}

// GET /api/v1/sales-returns
const list = asyncHandler(async (req, res) => {
  const { customer, q } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (customer) filter.customer = customer;
  if (q && q.trim()) {
    const rx = new RegExp(q.trim(), "i");
    const custs = await Customer.find({ name: rx }).select("_id").limit(200).lean();
    const ids = custs.map((c) => c._id);
    filter.$or = [{ number: rx }, ...(ids.length ? [{ customer: { $in: ids } }] : [])];
  }
  const items = await SalesReturn.find(filter)
    .populate("customer", "name mobile")
    .populate("showroom", "name code")
    .populate("order", "number")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/sales-returns/next-number
const nextNumber = asyncHandler(async (req, res) => {
  const seq = await Counter.peekSeq("sales_return");
  res.json({ success: true, number: `SRET-${String(seq).padStart(4, "0")}` });
});

// GET /api/v1/sales-returns/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await SalesReturn.findById(req.params.id)
    .populate("customer", "name mobile email gstin pan address city state pincode shippingAddress")
    .populate("showroom", "name code city state")
    .populate("order", "number")
    .populate("items.product", "name sku hsn unit")
    .lean();
  if (!item) throw new ApiError(404, "Sales return not found.");
  res.json({ success: true, item });
});

// POST /api/v1/sales-returns
const create = asyncHandler(async (req, res) => {
  const { customer, showroom, items } = req.body;
  if (!customer) throw new ApiError(400, "Customer is required.");
  if (!showroom) throw new ApiError(400, "Showroom is required.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Add at least one line item.");
  }

  const s = await Showroom.findById(showroom).select("_id").lean();
  if (!s) throw new ApiError(404, "Showroom not found.");

  const number = await nextReturnNumber();
  const ret = await SalesReturn.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });

  await restoreStock(ret, req.auth.user._id);
  ret.stockRestored = true;
  await ret.save();

  const created = await SalesReturn.findById(ret._id)
    .populate("customer", "name mobile")
    .populate("showroom", "name code")
    .populate("order", "number")
    .lean();

  res.status(201).json({ success: true, item: created });
});

module.exports = { list, nextNumber, getOne, create };
