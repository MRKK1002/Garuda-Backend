// StockLedger - immutable record of every stock movement for audit/history. One row
// per movement, capturing the change and the resulting available balance.
const mongoose = require("mongoose");

const stockLedgerSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },

    // Movement type.
    type: {
      type: String,
      enum: ["inward", "outward", "adjustment", "transfer_out", "transfer_in", "damaged"],
      required: true,
    },

    // Signed change to available stock (+in, -out).
    quantity: { type: Number, required: true },
    // Available balance after applying this movement.
    balance: { type: Number, required: true },

    note: { type: String, trim: true },
    // Optional reference to the source document (e.g. a transfer id).
    refType: { type: String, trim: true },
    refId: { type: mongoose.Schema.Types.ObjectId },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- Indexes ---
stockLedgerSchema.index({ product: 1, showroom: 1, createdAt: -1 });
stockLedgerSchema.index({ showroom: 1, createdAt: -1 });
stockLedgerSchema.index({ type: 1 });

module.exports = mongoose.model("StockLedger", stockLedgerSchema);
