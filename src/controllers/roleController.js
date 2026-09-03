// Role CRUD plus a catalog endpoint so the frontend can render the permission matrix.
const Role = require("../models/Role");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { PERMISSION_CATALOG } = require("../config/permissions");

// GET /api/v1/roles/permission-catalog  -> drives the create-role permission matrix
const permissionCatalog = asyncHandler(async (req, res) => {
  res.json({ success: true, catalog: PERMISSION_CATALOG });
});

// GET /api/v1/roles
const list = asyncHandler(async (req, res) => {
  const items = await Role.find().sort({ createdAt: 1 }).lean();
  res.json({ success: true, items });
});

// GET /api/v1/roles/:id
const getOne = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id).lean();
  if (!role) throw new ApiError(404, "Role not found.");
  res.json({ success: true, item: role });
});

// POST /api/v1/roles
const create = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;
  const role = await Role.create({ name, description, permissions });
  res.status(201).json({ success: true, item: role });
});

// PUT /api/v1/roles/:id
const update = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, "Role not found.");
  // Don't allow flipping the super-admin flag or renaming system roles' core identity.
  const { name, description, permissions } = req.body;
  if (name !== undefined) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = permissions;
  await role.save();
  res.json({ success: true, item: role });
});

// DELETE /api/v1/roles/:id
const remove = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, "Role not found.");
  if (role.isSystem) throw new ApiError(400, "System roles cannot be deleted.");
  await role.deleteOne();
  res.json({ success: true });
});

module.exports = { permissionCatalog, list, getOne, create, update, remove };
