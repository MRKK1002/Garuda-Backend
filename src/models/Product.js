// Product - catalogue master. Per the architecture decision (SOW), the product does
// NOT store showroom stock; per-showroom quantities live in the Inventory model
// (Sprint 3). This holds product info, media, specs, pricing and tax only.
const mongoose = require("mongoose");

// Free-form spec attributes (e.g. Width, Height, Material, Color).
const specSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    value: { type: String, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    model: { type: String, trim: true },
    productCode: { type: String, trim: true },

    // Brand and category are mandatory. If a sub-category is chosen in the UI, the
    // deepest category (the sub-category) is stored here.
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },

    images: [{ type: String }], // image URLs (uploaded or external)
    video: { type: String, trim: true }, // optional video URL
    specifications: [specSchema],

    // Variants, e.g. { name: "Color", value: "Red", sku: "...", price: 27000 }.
    variants: [
      new mongoose.Schema(
        {
          name: { type: String, trim: true },
          value: { type: String, trim: true },
          sku: { type: String, trim: true },
          price: { type: Number, default: 0, min: 0 },
        },
        { _id: false }
      ),
    ],

    // Pricing
    mrp: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },

    // Tax
    gst: { type: Number, default: 0, min: 0 }, // percentage
    hsn: { type: String, trim: true },

    // Featured flags
    isBestseller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      default: "active",
    },
  },
  { timestamps: true }
);

// --- Indexes ---
// `sku` already has a unique index from the schema definition.
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isFeatured: 1 });
// Text index for product search by name / model / code.
productSchema.index({ name: "text", model: "text", productCode: "text" });

module.exports = mongoose.model("Product", productSchema);
