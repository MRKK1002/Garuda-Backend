// Testimonial CRUD for admins + image upload. Public listing lives in shopController.
const Testimonial = require("../models/Testimonial");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/testimonials  (admin - all)
const list = asyncHandler(async (req, res) => {
  const items = await Testimonial.find().sort({ order: 1, createdAt: -1 }).lean();
  res.json({ success: true, items });
});

// GET /api/v1/testimonials/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Testimonial.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, "Testimonial not found.");
  res.json({ success: true, item });
});

// POST /api/v1/testimonials
const create = asyncHandler(async (req, res) => {
  if (!req.body.name) throw new ApiError(400, "Name is required.");
  if (!req.body.message) throw new ApiError(400, "Message is required.");
  const item = await Testimonial.create(req.body);
  res.status(201).json({ success: true, item });
});

// PUT /api/v1/testimonials/:id
const update = asyncHandler(async (req, res) => {
  const item = await Testimonial.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) throw new ApiError(404, "Testimonial not found.");
  res.json({ success: true, item });
});

// DELETE /api/v1/testimonials/:id
const remove = asyncHandler(async (req, res) => {
  const item = await Testimonial.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Testimonial not found.");
  res.json({ success: true });
});

// POST /api/v1/testimonials/upload  (multipart field: "image")
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

module.exports = { list, getOne, create, update, remove, uploadImage };
