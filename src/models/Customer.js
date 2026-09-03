// Customer - central customer master. Customers may originate from the showroom, CRM,
// website or mobile app (the `source` field). Assigned to a showroom + salesperson.
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },

    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },

    // New / existing / VIP / inactive, etc.
    segment: {
      type: String,
      enum: ["new", "existing", "vip", "inactive"],
      default: "new",
    },

    // Where the customer came from.
    source: {
      type: String,
      enum: ["showroom", "crm", "website", "mobile"],
      default: "crm",
    },

    assignedShowroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },
    assignedSalesperson: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
  },
  { timestamps: true }
);

// --- Indexes ---
customerSchema.index({ mobile: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ assignedShowroom: 1 });
customerSchema.index({ assignedSalesperson: 1 });
customerSchema.index({ segment: 1 });
customerSchema.index({ status: 1 });
// Search by name / mobile / email.
customerSchema.index({ name: "text", mobile: "text", email: "text" });

module.exports = mongoose.model("Customer", customerSchema);
