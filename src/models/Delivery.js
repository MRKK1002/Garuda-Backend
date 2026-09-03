// Delivery - scheduling and tracking for an order's fulfilment.
const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    scheduledDate: { type: Date },
    address: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: {
      type: String,
      enum: ["pending", "scheduled", "dispatched", "delivered", "failed"],
      default: "pending",
    },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// --- Indexes ---
deliverySchema.index({ order: 1 });
deliverySchema.index({ showroom: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ scheduledDate: 1 });

module.exports = mongoose.model("Delivery", deliverySchema);
