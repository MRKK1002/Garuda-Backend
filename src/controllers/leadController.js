// Lead controller. CRUD plus pipeline actions: change stage, add follow-up note, and
// convert to a quotation. Scoped to the user's showrooms.
const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");
const { nextQuotationNumber } = require("./quotationController");

const STAGES = ["new", "contacted", "qualified", "quotation", "negotiation", "won", "lost"];

// GET /api/v1/leads
const list = asyncHandler(async (req, res) => {
  const { stage, assignedTo, source } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (stage) filter.stage = stage;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (source) filter.source = source;
  const items = await Lead.find(filter)
    .populate("customer", "name mobile")
    .populate("product", "name sku")
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/leads/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Lead.findById(req.params.id)
    .populate("customer", "name mobile email")
    .populate("product", "name sku sellingPrice")
    .populate("assignedTo", "name")
    .lean();
  if (!item) throw new ApiError(404, "Lead not found.");
  res.json({ success: true, item });
});

// POST /api/v1/leads
const create = asyncHandler(async (req, res) => {
  const lead = await Lead.create(req.body);
  res.status(201).json({ success: true, item: lead });
});

// PUT /api/v1/leads/:id
const update = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!lead) throw new ApiError(404, "Lead not found.");
  res.json({ success: true, item: lead });
});

// PATCH /api/v1/leads/:id/stage  { stage, lostReason? }
const changeStage = asyncHandler(async (req, res) => {
  const { stage, lostReason } = req.body;
  if (!STAGES.includes(stage)) throw new ApiError(400, "Invalid stage.");
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, "Lead not found.");
  lead.stage = stage;
  if (stage === "lost" && lostReason) lead.lostReason = lostReason;
  await lead.save();
  res.json({ success: true, item: lead });
});

// POST /api/v1/leads/:id/follow-up  { text, followUpAt? }
const addFollowUp = asyncHandler(async (req, res) => {
  const { text, followUpAt } = req.body;
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new ApiError(404, "Lead not found.");
  if (text) lead.notes.push({ text, by: req.auth.user._id });
  if (followUpAt) lead.followUpAt = followUpAt;
  await lead.save();
  res.json({ success: true, item: lead });
});

// POST /api/v1/leads/:id/convert  -> creates a draft Quotation prefilled from the lead
const convert = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate("product");
  if (!lead) throw new ApiError(404, "Lead not found.");

  const items = [];
  if (lead.product) {
    items.push({
      product: lead.product._id,
      name: lead.product.name,
      quantity: 1,
      price: lead.product.sellingPrice || 0,
      discount: lead.product.discount || 0,
      gst: lead.product.gst || 0,
    });
  }

  const number = await nextQuotationNumber();
  const quotation = await Quotation.create({
    number,
    customer: lead.customer,
    lead: lead._id,
    showroom: lead.showroom,
    items,
    status: "draft",
    createdBy: req.auth.user._id,
  });

  // Advance the lead to the quotation stage.
  lead.stage = "quotation";
  await lead.save();

  res.status(201).json({ success: true, item: quotation });
});

// DELETE /api/v1/leads/:id
const remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) throw new ApiError(404, "Lead not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, changeStage, addFollowUp, convert, remove };
