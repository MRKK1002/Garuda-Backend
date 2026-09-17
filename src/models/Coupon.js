// Coupon — discount codes redeemable at checkout.
// Supports flat (amount) and percent discount types, minimum order value,
// optional category restrictions, expiry date and usage limits.
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String, trim: true },

    // Discount type: flat ₹ amount or percentage.
    type: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    value: { type: Number, required: true, min: 0 }, // ₹ or %

    // Maximum discount when type is "percent" (optional cap).
    maxDiscount: { type: Number, default: null },

    // Minimum cart total for the coupon to be valid.
    minOrderAmount: { type: Number, default: 0 },

    // If empty → applies to all categories. If set → only applies when cart
    // contains at least one product from one of these categories.
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    // Usage limits.
    usageLimit: { type: Number, default: null },  // null = unlimited
    usedCount: { type: Number, default: 0 },

    // Validity window.
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// `code` already has a unique index from the schema definition above.
couponSchema.index({ status: 1 });
couponSchema.index({ expiryDate: 1 });

module.exports = mongoose.model("Coupon", couponSchema);
