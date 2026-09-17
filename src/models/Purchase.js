// Purchase (Purchase Invoice) - a bill received from a supplier. Recording a purchase
// brings stock IN to a warehouse (product + warehouse Inventory). Line items carry
// price/qty/discount/tax; totals are computed on save. Tracks amount paid + status.
const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, trim: true }, // snapshot of product name
    hsn: { type: String, trim: true },
    unit: { type: String, trim: true, default: "PCS" },
    quantity: { type: Number, default: 1, min: 0 },
    price: { type: Number, default: 0, min: 0 }, // purchase price per unit
    discount: { type: Number, default: 0, min: 0 },
    gst: { type: Number, default: 0, min: 0 }, // percentage
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    // Human-friendly serial, e.g. PUR-0001.
    number: { type: String, unique: true },
    // Supplier's own invoice number (optional, printed on their bill).
    originalInvoiceNo: { type: String, trim: true },

    // Supplier is a Party (Customer with partyType "supplier").
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    // The warehouse the purchased stock is received into.
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },

    items: { type: [purchaseItemSchema], default: [] },

    // Optional logistics fields (mirrors the reference UI).
    ewayBill: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },

    notes: { type: String, trim: true },
    terms: { type: String, trim: true },

    // Extra charges / bill-level discount applied after line items.
    additionalCharges: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },

    // Computed totals.
    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // Payment tracking (like an order).
    amountPaid: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },

    // Whether stock has been received into the warehouse for this purchase (so we
    // don't double-add if the record is saved again).
    stockReceived: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compute totals from line items before validation/save. Purchase prices are treated
// as tax-inclusive here (matching the sales side): the GST portion is decomposed out
// of the line amount rather than added on top.
purchaseSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const lineBase = (it.price || 0) * (it.quantity || 0);
    const lineDiscount = it.discount || 0;
    const net = Math.max(lineBase - lineDiscount, 0);
    const rate = it.gst || 0;
    const taxable = rate > 0 ? net / (1 + rate / 100) : net;
    const lineTax = net - taxable;
    subtotal += lineBase;
    totalDiscount += lineDiscount;
    totalTax += lineTax;
  }
  const extra = this.additionalCharges || 0;
  const billDisc = this.billDiscount || 0;
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.totalDiscount = totalDiscount;
  this.totalTax = Math.round(totalTax * 100) / 100;
  this.grandTotal = Math.max(subtotal - totalDiscount, 0) + extra - billDisc;

  // Derive payment status from amountPaid vs grandTotal.
  if (this.amountPaid >= this.grandTotal && this.grandTotal > 0) this.paymentStatus = "paid";
  else if (this.amountPaid > 0) this.paymentStatus = "partial";
  else this.paymentStatus = "unpaid";
});

// --- Indexes ---
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ warehouse: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ number: 1 });

module.exports = mongoose.model("Purchase", purchaseSchema);
