// Home page promotional banner, managed by admins and shown in the storefront hero.
const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true }, // public URL (uploaded or external)
    badge: { type: String, trim: true },      // optional, e.g. "New Arrival"
    title: { type: String, trim: true },       // optional
    subtitle: { type: String, trim: true },    // optional
    buttonText: { type: String, trim: true },   // optional
    buttonLink: { type: String, trim: true },   // optional
    order: { type: Number, default: 0 },        // display order (ascending)
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

bannerSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
