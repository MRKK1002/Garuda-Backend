// StockTransfer - moves stock between locations with an approval workflow:
// requested -> approved -> dispatched -> received (or cancelled/rejected).
// Stock is reserved at the source on dispatch and applied at the destination on
// receive (handled in the controller).
const mongoose = require("mongoose");

const transferItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const stockTransferSchema = new mongoose.Schema(
  {
    fromShowroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    toShowroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    items: { type: [transferItemSchema], required: true },

    status: {
      type: String,
      enum: ["requested", "approved", "dispatched", "received", "cancelled", "rejected"],
      default: "requested",
    },

    note: { type: String, trim: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- Indexes ---
stockTransferSchema.index({ status: 1 });
stockTransferSchema.index({ fromShowroom: 1 });
stockTransferSchema.index({ toShowroom: 1 });
stockTransferSchema.index({ createdAt: -1 });

module.exports = mongoose.model("StockTransfer", stockTransferSchema);
