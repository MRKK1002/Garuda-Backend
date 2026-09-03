// Target - a sales target for a showroom over a period (month/year). Performance is
// computed by comparing against actual orders in that period.
const mongoose = require("mongoose");

const targetSchema = new mongoose.Schema(
  {
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    // Period, e.g. "2026-09" (month) or "2026" (year).
    period: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

// One target per showroom+period.
targetSchema.index({ showroom: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("Target", targetSchema);
