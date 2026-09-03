// User - a system login. Belongs to a Role (which carries permissions) and has access
// to one or more Showrooms. Password is hashed with bcrypt before saving.
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobile: { type: String, trim: true },
    username: { type: String, trim: true },

    // Never returned by default (select: false) so it doesn't leak in queries.
    password: { type: String, required: true, select: false },

    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },

    // Showrooms this user can access. Empty for org-wide roles (e.g. Super Admin).
    showrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Showroom" }],

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },

    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Hash the password whenever it is set/changed. Using the async (promise) style, so
// no `next` callback is used (Mongoose awaits the returned promise).
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance helper to verify a plaintext password against the stored hash.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// --- Indexes (keep reads fast) ---
// email already has a unique index from the schema definition above.
userSchema.index({ role: 1 });
userSchema.index({ showrooms: 1 });
userSchema.index({ status: 1 });
// Common admin filter: users of a role within a showroom.
userSchema.index({ showrooms: 1, role: 1 });

module.exports = mongoose.model("User", userSchema);
