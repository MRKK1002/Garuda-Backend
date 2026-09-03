// Payment - a payment recorded against an order.
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    amount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ["cash", "card", "upi", "netbanking", "cheque", "other"],
      default: "cash",
    },
    reference: { type: String, trim: true }, // txn id / cheque no
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
      default: "success",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- Indexes ---
paymentSchema.index({ order: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ showroom: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
