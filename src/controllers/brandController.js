// Brand CRUD.
const Brand = require("../models/Brand");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/brands
const list = asyncHandler(async (req, res) => {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.name = new RegExp(q, "i");
  const items = await Brand.find(filter).sort({ name: 1 }).lean();
  res.json({ success: true, items });
});

// GET /api/v1/brands/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Brand.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, "Brand not found.");
  res.json({ success: true, item });
});

// POST /api/v1/brands
const create = asyncHandler(async (req, res) => {
  const { name, description, logo, status } = req.body;
  const item = await Brand.create({ name, description, logo, status });
  res.status(201).json({ success: true, item });
});

// PUT /api/v1/brands/:id
const update = asyncHandler(async (req, res) => {
  const item = await Brand.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new ApiError(404, "Brand not found.");
  res.json({ success: true, item });
});

// DELETE /api/v1/brands/:id
const remove = asyncHandler(async (req, res) => {
  const item = await Brand.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Brand not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, remove };
