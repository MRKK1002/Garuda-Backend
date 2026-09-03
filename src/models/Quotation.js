// Quotation - a priced offer to a customer, optionally generated from a lead. Line
// items carry price/qty/discount/tax; totals are computed on save.
const mongoose = require("mongoose");

const quotationItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, trim: true }, // snapshot of product name
    quantity: { type: Number, default: 1, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 }, // percentage
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    // Human-friendly number, e.g. QT-000123.
    number: { type: String, unique: true },

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },

    items: { type: [quotationItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "sent", "approved", "accepted", "rejected", "converted"],
      default: "draft",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compute totals from line items before validation/save. Synchronous hook (no `next`
// callback, per Mongoose 9).
quotationSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const lineBase = (it.price || 0) * (it.quantity || 0);
    const lineDiscount = it.discount || 0;
    const taxable = Math.max(lineBase - lineDiscount, 0);
    const lineTax = (taxable * (it.gst || 0)) / 100;
    subtotal += lineBase;
    totalDiscount += lineDiscount;
    totalTax += lineTax;
  }
  this.subtotal = subtotal;
  this.totalDiscount = totalDiscount;
  this.totalTax = totalTax;
  this.grandTotal = Math.max(subtotal - totalDiscount, 0) + totalTax;
});

// --- Indexes ---
// `number` already has a unique index from the schema definition.
quotationSchema.index({ customer: 1 });
quotationSchema.index({ lead: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ showroom: 1 });

module.exports = mongoose.model("Quotation", quotationSchema);
