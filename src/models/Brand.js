// Brand - simple master for product brands.
const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, trim: true }, // optional logo URL
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// --- Indexes ---
// `name` already has a unique index from the schema definition.
brandSchema.index({ status: 1 });

module.exports = mongoose.model("Brand", brandSchema);
