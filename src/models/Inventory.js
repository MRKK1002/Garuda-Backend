// Inventory - stock held for a specific product at a specific showroom. Per the SOW
// architecture, stock is a (product + showroom) record, NOT a field on the product.
const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },

    available: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },

    // Low-stock threshold for alerts.
    minStock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// --- Indexes ---
// One stock record per product+showroom.
inventorySchema.index({ product: 1, showroom: 1 }, { unique: true });
inventorySchema.index({ showroom: 1 });
inventorySchema.index({ product: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
