// Credit Note controller (sales side). Accounting document only — no stock change.
const CreditNote = require("../models/CreditNote");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

async function nextCreditNoteNumber() {
  const seq = await Counter.nextSeq("credit_note");
  return `CN-${String(seq).padStart(4, "0")}`;
}

// GET /api/v1/credit-notes
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
  const items = await CreditNote.find(filter)
    .populate("customer", "name mobile")
    .populate("order", "number")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/credit-notes/next-number
const nextNumber = asyncHandler(async (req, res) => {
  const seq = await Counter.peekSeq("credit_note");
  res.json({ success: true, number: `CN-${String(seq).padStart(4, "0")}` });
});

// GET /api/v1/credit-notes/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await CreditNote.findById(req.params.id)
    .populate("customer", "name mobile email gstin pan address city state pincode shippingAddress")
    .populate("showroom", "name code city state")
    .populate("order", "number")
    .populate("items.product", "name sku hsn unit")
    .lean();
  if (!item) throw new ApiError(404, "Credit note not found.");
  res.json({ success: true, item });
});

// POST /api/v1/credit-notes
const create = asyncHandler(async (req, res) => {
  const { customer, items } = req.body;
  if (!customer) throw new ApiError(400, "Customer is required.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Add at least one line item.");
  }

  const number = await nextCreditNoteNumber();
  const note = await CreditNote.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });

  const created = await CreditNote.findById(note._id)
    .populate("customer", "name mobile")
    .populate("order", "number")
    .lean();

  res.status(201).json({ success: true, item: created });
});

module.exports = { list, nextNumber, getOne, create };
