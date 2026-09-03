// Return - a return request against a delivered order. On approval, returned items go
// back into available stock and an optional refund payment is recorded.
const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    items: { type: [returnItemSchema], default: [] },
    reason: { type: String, trim: true },
    refundAmount: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ["requested", "approved", "rejected", "refunded"],
      default: "requested",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- Indexes ---
returnSchema.index({ order: 1 });
returnSchema.index({ customer: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Return", returnSchema);
