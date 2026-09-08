// Product review by a verified-purchase customer. Rating 1-5, optional text + images.
const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, trim: true }, // snapshot for display
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true },
    images: [{ type: String }], // uploaded image URLs
    verifiedPurchase: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One review per customer per product.
reviewSchema.index({ product: 1, customer: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
