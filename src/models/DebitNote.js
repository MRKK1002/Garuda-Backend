// DebitNote - accounting document raised against a SUPPLIER (purchase side). Reduces
// what we owe the supplier (e.g. for returned/damaged goods or overbilling). Unlike a
// Purchase Return, it does NOT change stock — it is a money/accounting document only.
// Serial: DN-0001.
const mongoose = require("mongoose");

const debitItemSchema = new mongoose.Schema(
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

const debitNoteSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true }, // DN-0001

    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    // Optional link to the purchase invoice this note adjusts.
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase" },

    items: { type: [debitItemSchema], default: [] },

    ewayBill: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    noteDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },

    additionalCharges: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // Settlement (how much of this debit note has been adjusted/received back).
    amountPaid: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Tax-exclusive totals (GST added on top), same as purchase documents.
debitNoteSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const lineBase = (it.price || 0) * (it.quantity || 0);
    const lineDiscount = it.discount || 0;
    const taxable = Math.max(lineBase - lineDiscount, 0);
    totalTax += (taxable * (it.gst || 0)) / 100;
    subtotal += lineBase;
    totalDiscount += lineDiscount;
  }
  const extra = this.additionalCharges || 0;
  const billDisc = this.billDiscount || 0;
  const taxableAfterDisc = Math.max(subtotal - totalDiscount, 0);
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.totalDiscount = totalDiscount;
  this.totalTax = Math.round(totalTax * 100) / 100;
  this.grandTotal = Math.round((taxableAfterDisc + this.totalTax + extra - billDisc) * 100) / 100;

  if (this.amountPaid >= this.grandTotal && this.grandTotal > 0) this.paymentStatus = "paid";
  else if (this.amountPaid > 0) this.paymentStatus = "partial";
  else this.paymentStatus = "unpaid";
});

debitNoteSchema.index({ supplier: 1 });
debitNoteSchema.index({ purchase: 1 });
debitNoteSchema.index({ createdAt: -1 });
debitNoteSchema.index({ number: 1 });

module.exports = mongoose.model("DebitNote", debitNoteSchema);
