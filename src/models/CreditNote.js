// CreditNote - accounting document issued to a CUSTOMER (sales side). Reduces what the
// customer owes us (e.g. for returned goods or overcharging). Unlike a Sales Return,
// it does NOT change stock — it is a money/accounting document only. Serial: CN-0001.
const mongoose = require("mongoose");

const creditItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, trim: true },
    hsn: { type: String, trim: true },
    unit: { type: String, trim: true, default: "PCS" },
    quantity: { type: Number, default: 1, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const creditNoteSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true }, // CN-0001

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom" },
    // Optional link to the sales invoice (order) this note adjusts.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    items: { type: [creditItemSchema], default: [] },

    noteDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },

    additionalCharges: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // How much of this credit has been refunded/adjusted.
    amountRefunded: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["unpaid", "partial", "refunded"],
      default: "unpaid",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Sales prices are tax-INCLUSIVE (like the sales invoice): GST decomposed out.
creditNoteSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const lineBase = (it.price || 0) * (it.quantity || 0);
    const lineDiscount = it.discount || 0;
    const net = Math.max(lineBase - lineDiscount, 0);
    const rate = it.gst || 0;
    const taxable = rate > 0 ? net / (1 + rate / 100) : net;
    totalTax += net - taxable;
    subtotal += lineBase;
    totalDiscount += lineDiscount;
  }
  const extra = this.additionalCharges || 0;
  const billDisc = this.billDiscount || 0;
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.totalDiscount = totalDiscount;
  this.totalTax = Math.round(totalTax * 100) / 100;
  this.grandTotal = Math.round((Math.max(subtotal - totalDiscount, 0) + extra - billDisc) * 100) / 100;

  if (this.amountRefunded >= this.grandTotal && this.grandTotal > 0) this.refundStatus = "refunded";
  else if (this.amountRefunded > 0) this.refundStatus = "partial";
  else this.refundStatus = "unpaid";
});

creditNoteSchema.index({ customer: 1 });
creditNoteSchema.index({ order: 1 });
creditNoteSchema.index({ createdAt: -1 });
creditNoteSchema.index({ number: 1 });

module.exports = mongoose.model("CreditNote", creditNoteSchema);
