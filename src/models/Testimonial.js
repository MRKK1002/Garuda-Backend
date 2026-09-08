// Customer testimonial shown on the storefront home ("What our customers say").
const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },      // optional, e.g. "Bengaluru" or "Verified Buyer"
    message: { type: String, required: true, trim: true },
    photo: { type: String, trim: true },      // optional avatar URL
    rating: { type: Number, min: 1, max: 5, default: 5 },
    order: { type: Number, default: 0 },       // display order (ascending)
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

testimonialSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model("Testimonial", testimonialSchema);
