// Order - a confirmed sale. Items snapshot pricing; totals computed on save. Stock is
// reserved when the order is confirmed and released to "sold" when delivered (handled
// in the controller). Lifecycle: new -> confirmed -> processing -> dispatched ->
// delivered (or cancelled).
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true },

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    salesperson: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: "Quotation" },

    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["new", "confirmed", "processing", "dispatched", "delivered", "cancelled"],
      default: "new",
    },

    // Tracks whether stock has been reserved for this order (set on confirm).
    stockAllocated: { type: Boolean, default: false },

    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "failed", "refunded"],
      default: "pending",
    },
    amountPaid: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compute totals before validate (sync hook, no next per Mongoose 9).
orderSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const base = (it.price || 0) * (it.quantity || 0);
    const disc = it.discount || 0;
    const taxable = Math.max(base - disc, 0);
    subtotal += base;
    totalDiscount += disc;
    totalTax += (taxable * (it.gst || 0)) / 100;
  }
  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = totalTax;
  this.grandTotal = Math.max(subtotal - totalDiscount, 0) + totalTax;
});

// --- Indexes ---
orderSchema.index({ customer: 1 });
orderSchema.index({ showroom: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
