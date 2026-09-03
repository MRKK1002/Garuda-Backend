// Showroom - a physical retail location. Captures the fields required by the SOW:
// name, code, address, contact, GST and operating details.
const mongoose = require("mongoose");

const showroomSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },

    // Address
    address: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true },

    // Contact
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    // Business
    gstin: { type: String, trim: true },

    // Operating details
    openingTime: { type: String, trim: true }, // e.g. "10:00 AM"
    closingTime: { type: String, trim: true }, // e.g. "08:00 PM"

    // Manager is a User; assigned separately so we avoid a circular require here.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// --- Indexes ---
// `code` already has a unique index from the schema definition above.
showroomSchema.index({ status: 1 });
showroomSchema.index({ city: 1 });
showroomSchema.index({ organization: 1 });
showroomSchema.index({ manager: 1 });
// Text index for name/city search from the showrooms list search box.
showroomSchema.index({ name: "text", city: "text" });

module.exports = mongoose.model("Showroom", showroomSchema);
