// Role - a named set of permissions. Permissions are stored as an array of
// "<module>.<action>" keys drawn from the permission catalog (config/permissions.js).
// isSystem marks built-in roles (like Super Admin) that shouldn't be deleted.
const mongoose = require("mongoose");
const { allPermissionKeys } = require("../config/permissions");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    permissions: {
      type: [String],
      default: [],
      // Validate each entry is a known permission key.
      validate: {
        validator: (perms) => {
          const valid = new Set(allPermissionKeys());
          return perms.every((p) => valid.has(p));
        },
        message: "Contains an unknown permission key.",
      },
    },
    // Super Admin bypasses individual permission checks (has everything).
    isSuperAdmin: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// --- Indexes ---
// `name` already has a unique index from the schema definition above.
roleSchema.index({ isSuperAdmin: 1 });

module.exports = mongoose.model("Role", roleSchema);
