// Showroom CRUD. List supports search (?q=) and status filter, and is scoped to the
// user's accessible showrooms.
const Showroom = require("../models/Showroom");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

// GET /api/v1/showrooms
const list = asyncHandler(async (req, res) => {
  const { q, status } = req.query;

  // Base scope: only showrooms this user may see (Super Admin sees all).
  const filter = { ...scopeQuery(req, "_id") };
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { city: new RegExp(q, "i") },
      { code: new RegExp(q, "i") },
    ];
  }

  const items = await Showroom.find(filter)
    .populate("manager", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, items });
});

// GET /api/v1/showrooms/:id
const getOne = asyncHandler(async (req, res) => {
  assertShowroomAccess(req, req.params.id);
  const showroom = await Showroom.findById(req.params.id)
    .populate("manager", "name email")
    .lean();
  if (!showroom) throw new ApiError(404, "Showroom not found.");
  res.json({ success: true, item: showroom });
});

// POST /api/v1/showrooms
const create = asyncHandler(async (req, res) => {
  const showroom = await Showroom.create(req.body);
  res.status(201).json({ success: true, item: showroom });
});

// PUT /api/v1/showrooms/:id
const update = asyncHandler(async (req, res) => {
  assertShowroomAccess(req, req.params.id);
  const showroom = await Showroom.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!showroom) throw new ApiError(404, "Showroom not found.");
  res.json({ success: true, item: showroom });
});

// DELETE /api/v1/showrooms/:id
const remove = asyncHandler(async (req, res) => {
  assertShowroomAccess(req, req.params.id);
  const showroom = await Showroom.findByIdAndDelete(req.params.id);
  if (!showroom) throw new ApiError(404, "Showroom not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, remove };
