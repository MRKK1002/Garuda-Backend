// Category CRUD. List supports filtering by parent (?parent=<id> or ?parent=root) and
// returns categories with their parent populated so the frontend can build a tree.
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/v1/categories
const list = asyncHandler(async (req, res) => {
  const { parent, status, q } = req.query;
  const filter = {};
  if (parent === "root") filter.parent = null;
  else if (parent) filter.parent = parent;
  if (status) filter.status = status;
  if (q) filter.name = new RegExp(q, "i");

  const items = await Category.find(filter)
    .populate("parent", "name")
    .sort({ name: 1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/categories/:id
const getOne = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id).populate("parent", "name").lean();
  if (!item) throw new ApiError(404, "Category not found.");
  res.json({ success: true, item });
});

// POST /api/v1/categories
const create = asyncHandler(async (req, res) => {
  const { name, parent, image, description, status } = req.body;
  const item = await Category.create({
    name,
    parent: parent || null,
    image,
    description,
    status,
  });
  res.status(201).json({ success: true, item });
});

// PUT /api/v1/categories/:id
const update = asyncHandler(async (req, res) => {
  const { name, parent, image, description, status } = req.body;
  const item = await Category.findByIdAndUpdate(
    req.params.id,
    { name, parent: parent || null, image, description, status },
    { new: true, runValidators: true }
  );
  if (!item) throw new ApiError(404, "Category not found.");
  res.json({ success: true, item });
});

// POST /api/v1/categories/upload  (multipart form field: "image")
// Uploads a single category image and returns its public URL.
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

// DELETE /api/v1/categories/:id
const remove = asyncHandler(async (req, res) => {
  // Prevent deleting a category that still has sub-categories.
  const childCount = await Category.countDocuments({ parent: req.params.id });
  if (childCount > 0) {
    throw new ApiError(400, "Remove or reassign sub-categories first.");
  }
  const item = await Category.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Category not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, remove, uploadImage };
