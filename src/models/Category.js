// Category - supports sub-categories via a self-referencing `parent`. Top-level
// categories have parent = null.
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// --- Indexes ---
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ name: 1 });

module.exports = mongoose.model("Category", categorySchema);
