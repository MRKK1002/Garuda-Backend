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

    // Where this order comes from and how it's paid (online orders vs showroom).
    channel: {
      type: String,
      enum: ["showroom", "website", "mobile"],
      default: "showroom",
    },
    // Delivery address snapshot (for website orders; may differ from the customer's
    // default address).
    deliveryAddress: {
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
    },
    paymentMethod: { type: String, trim: true }, // e.g. "online", "cod"

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    coupon: { type: String, default: null },          // coupon code applied
    couponDiscount: { type: Number, default: 0 },     // discount amount from coupon
    grandTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["new", "confirmed", "processing", "dispatched", "delivered", "cancelled"],
      default: "new",
    },
    // Tracks whether stock has been reserved for this order (set on confirm).
    stockAllocated: { type: Boolean, default: false },

    // Fulfillment status for online orders. "pending_assignment" means no showroom
    // had full stock and staff must assign/restock before it can be fulfilled.
    fulfillmentStatus: {
      type: String,
      enum: ["allocated", "pending_assignment"],
      default: "allocated",
    },

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

// Compute totals before validate. Prices are stored inclusive of GST —
// the gst field is informational only (for invoice breakdowns), not added
// on top of the price again.
orderSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const base = (it.price || 0) * (it.quantity || 0);
    const disc = it.discount || 0;
    subtotal += base;
    totalDiscount += disc;
    if (it.gst > 0) {
      const taxable = Math.max(base - disc, 0);
      totalTax += taxable - taxable / (1 + it.gst / 100);
    }
  }
  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = Math.round(totalTax * 100) / 100;
  // grandTotal = price paid — item discounts and coupon discount applied, GST already included in price.
  const beforeCoupon = Math.max(subtotal - totalDiscount, 0);
  const couponDisc = Math.min(this.couponDiscount || 0, beforeCoupon);
  this.grandTotal = Math.max(beforeCoupon - couponDisc, 0);
});
// --- Indexes ---
orderSchema.index({ customer: 1 });
orderSchema.index({ showroom: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
// Compound index for the paginated list: scoped by showroom, newest first.
orderSchema.index({ showroom: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
// Invoice number lookups / search.
orderSchema.index({ number: 1 });
module.exports = mongoose.model("Order", orderSchema);
