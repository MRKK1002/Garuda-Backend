// User CRUD. Users carry a role and showroom access. List is scoped so a manager only
// sees users within their showrooms.
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

// GET /api/v1/users
const list = asyncHandler(async (req, res) => {
  const { q, status, role } = req.query;

  // Scope by showroom access (field on User is "showrooms").
  const filter = { ...scopeQuery(req, "showrooms") };
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { mobile: new RegExp(q, "i") },
    ];
  }

  const items = await User.find(filter)
    .populate("role", "name isSuperAdmin")
    .populate("showrooms", "name code")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, items });
});

// GET /api/v1/users/:id
const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate("role", "name isSuperAdmin")
    .populate("showrooms", "name code")
    .lean();
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ success: true, item: user });
});

// POST /api/v1/users
const create = asyncHandler(async (req, res) => {
  const { name, email, mobile, username, password, role, showrooms, status } = req.body;
  if (!password) throw new ApiError(400, "Password is required.");
  const user = await User.create({
    name,
    email,
    mobile,
    username,
    password,
    role,
    showrooms,
    status,
  });
  const created = await User.findById(user._id)
    .populate("role", "name isSuperAdmin")
    .populate("showrooms", "name code")
    .lean();
  res.status(201).json({ success: true, item: created });
});

// PUT /api/v1/users/:id
const update = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");

  const fields = ["name", "email", "mobile", "username", "role", "showrooms", "status"];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f];
  });
  // Only re-hash when a new password is explicitly provided.
  if (req.body.password) user.password = req.body.password;

  await user.save();
  const updated = await User.findById(user._id)
    .populate("role", "name isSuperAdmin")
    .populate("showrooms", "name code")
    .lean();
  res.json({ success: true, item: updated });
});

// DELETE /api/v1/users/:id
const remove = asyncHandler(async (req, res) => {
  if (String(req.auth.user._id) === String(req.params.id)) {
    throw new ApiError(400, "You cannot delete your own account.");
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ success: true });
});

module.exports = { list, getOne, create, update, remove };
