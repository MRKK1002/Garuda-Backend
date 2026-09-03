// Quotation CRUD. Totals are computed by the model. A simple sequential number is
// generated from the current count (fine for this scale).
const Quotation = require("../models/Quotation");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

// Generate the next quotation number, e.g. QT-000042.
async function nextQuotationNumber() {
  const count = await Quotation.countDocuments();
  return `QT-${String(count + 1).padStart(6, "0")}`;
}

// GET /api/v1/quotations
const list = asyncHandler(async (req, res) => {
  const { status, customer } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  const items = await Quotation.find(filter)
    .populate("customer", "name mobile")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/quotations/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Quotation.findById(req.params.id)
    .populate("customer", "name mobile email")
    .populate("items.product", "name sku")
    .lean();
  if (!item) throw new ApiError(404, "Quotation not found.");
  res.json({ success: true, item });
});

// POST /api/v1/quotations
const create = asyncHandler(async (req, res) => {
  const number = await nextQuotationNumber();
  const quotation = await Quotation.create({
    ...req.body,
    number,
    createdBy: req.auth.user._id,
  });
  const created = await Quotation.findById(quotation._id)
    .populate("customer", "name mobile")
    .lean();
  res.status(201).json({ success: true, item: created });
});

// PUT /api/v1/quotations/:id
const update = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, "Quotation not found.");
  const fields = ["items", "status", "customer", "showroom"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) quotation[f] = req.body[f];
  });
  await quotation.save(); // triggers total recompute
  res.json({ success: true, item: quotation });
});

// DELETE /api/v1/quotations/:id
const remove = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findByIdAndDelete(req.params.id);
  if (!quotation) throw new ApiError(404, "Quotation not found.");
  res.json({ success: true });
});

// PATCH /api/v1/quotations/:id/status  { action }
// Workflow: draft -> send -> approve -> accept / reject. "convert" is handled separately.
const changeStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const q = await Quotation.findById(req.params.id);
  if (!q) throw new ApiError(404, "Quotation not found.");

  const transitions = {
    send: { from: ["draft", "approved"], to: "sent" },
    approve: { from: ["draft", "sent"], to: "approved" },
    accept: { from: ["sent", "approved"], to: "accepted" },
    reject: { from: ["draft", "sent", "approved"], to: "rejected" },
  };
  const rule = transitions[action];
  if (!rule) throw new ApiError(400, `Unknown action: ${action}`);
  if (!rule.from.includes(q.status)) {
    throw new ApiError(400, `Cannot ${action} a quotation that is '${q.status}'.`);
  }
  q.status = rule.to;
  await q.save();
  res.json({ success: true, item: q });
});

// POST /api/v1/quotations/:id/convert -> creates an Order from an accepted quotation.
const convertToOrder = asyncHandler(async (req, res) => {
  const Order = require("../models/Order");
  const q = await Quotation.findById(req.params.id);
  if (!q) throw new ApiError(404, "Quotation not found.");
  if (q.status === "converted") throw new ApiError(400, "Quotation already converted.");
  if (!q.showroom) throw new ApiError(400, "Quotation has no showroom; set one before converting.");

  const count = await Order.countDocuments();
  const number = `ORD-${String(count + 1).padStart(6, "0")}`;

  const order = await Order.create({
    number,
    customer: q.customer,
    showroom: q.showroom,
    quotation: q._id,
    items: q.items.map((it) => ({
      product: it.product,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      discount: it.discount,
      gst: it.gst,
    })),
    createdBy: req.auth.user._id,
  });

  q.status = "converted";
  await q.save();

  res.status(201).json({ success: true, item: order });
});

module.exports = { list, getOne, create, update, remove, changeStatus, convertToOrder, nextQuotationNumber };
