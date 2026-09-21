// PurchasePayment - a payment MADE to a supplier against a purchase invoice
// (Payment Out). Mirror of Payment (which is money received from customers).
const mongoose = require("mongoose");

const purchasePaymentSchema = new mongoose.Schema(
  {
    // Human-friendly serial, e.g. PAYOUT-0001. A multi-invoice settlement shares one
    // number across the rows it creates.
    number: { type: String },

    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    amount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ["cash", "card", "upi", "netbanking", "cheque", "bank_transfer", "other"],
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

purchasePaymentSchema.index({ number: 1 });
purchasePaymentSchema.index({ purchase: 1 });
purchasePaymentSchema.index({ supplier: 1 });
purchasePaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PurchasePayment", purchasePaymentSchema);
