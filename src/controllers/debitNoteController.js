// Debit Note controller (purchase side). Accounting document only — no stock change.
const DebitNote = require("../models/DebitNote");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

async function nextDebitNoteNumber() {
  const seq = await Counter.nextSeq("debit_note");
  return `DN-${String(seq).padStart(4, "0")}`;
}

// GET /api/v1/debit-notes
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
  const items = await DebitNote.find(filter)
    .populate("supplier", "name mobile")
    .populate("purchase", "number")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/debit-notes/next-number  (peek, no consume)
const nextNumber = asyncHandler(async (req, res) => {
  const seq = await Counter.peekSeq("debit_note");
  res.json({ success: true, number: `DN-${String(seq).padStart(4, "0")}` });
});

// GET /api/v1/debit-notes/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await DebitNote.findById(req.params.id)
    .populate("supplier", "name mobile email gstin pan address city state pincode")
    .populate("purchase", "number")
    .populate("items.product", "name sku hsn unit")
    .lean();
  if (!item) throw new ApiError(404, "Debit note not found.");
  res.json({ success: true, item });
});

// POST /api/v1/debit-notes
const create = asyncHandler(async (req, res) => {
  const { supplier, items } = req.body;
  if (!supplier) throw new ApiError(400, "Supplier is required.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Add at least one line item.");
  }

  const number = await nextDebitNoteNumber();
  const note = await DebitNote.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });

  const created = await DebitNote.findById(note._id)
    .populate("supplier", "name mobile")
    .populate("purchase", "number")
    .lean();

  res.status(201).json({ success: true, item: created });
});

module.exports = { list, nextNumber, getOne, create };
