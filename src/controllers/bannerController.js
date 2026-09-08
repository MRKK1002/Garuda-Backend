// Banner CRUD for admins + image upload. Public listing lives in shopController.
const Banner = require("../models/Banner");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/banners  (admin - all banners)
const list = asyncHandler(async (req, res) => {
  const items = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
  res.json({ success: true, items });
});

// GET /api/v1/banners/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Banner.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, "Banner not found.");
  res.json({ success: true, item });
});

// POST /api/v1/banners
const create = asyncHandler(async (req, res) => {
  if (!req.body.image) throw new ApiError(400, "Banner image is required.");
  const item = await Banner.create(req.body);
  res.status(201).json({ success: true, item });
});

// PUT /api/v1/banners/:id
const update = asyncHandler(async (req, res) => {
  const item = await Banner.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new ApiError(404, "Banner not found.");
  res.json({ success: true, item });
});

// DELETE /api/v1/banners/:id
const remove = asyncHandler(async (req, res) => {
  const item = await Banner.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Banner not found.");
  res.json({ success: true });
});

// POST /api/v1/banners/upload  (multipart form field: "image")
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

module.exports = { list, getOne, create, update, remove, uploadImage };
