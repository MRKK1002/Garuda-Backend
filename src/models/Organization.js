// Organization / Company - the top of the hierarchy. Single-tenant for now, but
// modeled as its own entity so everything can be scoped under it later.
const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    gstin: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// --- Indexes ---
organizationSchema.index({ isActive: 1 });

module.exports = mongoose.model("Organization", organizationSchema);
