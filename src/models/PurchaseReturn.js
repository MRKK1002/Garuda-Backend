// PurchaseReturn - goods returned to a supplier against a purchase invoice. On save,
// the returned quantities are REMOVED from the warehouse stock (opposite of a
// purchase, which adds stock). Serial: PRET-0001.
const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
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

const purchaseReturnSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true }, // PRET-0001

    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    // The purchase invoice this return is against (optional but recommended).
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase" },

    items: { type: [returnItemSchema], default: [] },

    ewayBill: { type: String, trim: true },
    vehicleNo: { type: String, trim: true },
    returnDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },

    additionalCharges: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // Whether the returned stock has been removed from the warehouse.
    stockRemoved: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Totals: prices are tax-exclusive (GST added on top), same as purchase invoices.
purchaseReturnSchema.pre("validate", function computeTotals() {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  for (const it of this.items) {
    const lineBase = (it.price || 0) * (it.quantity || 0);
    const lineDiscount = it.discount || 0;
    const taxable = Math.max(lineBase - lineDiscount, 0);
    const rate = it.gst || 0;
    totalTax += (taxable * rate) / 100;
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
});

purchaseReturnSchema.index({ supplier: 1 });
purchaseReturnSchema.index({ warehouse: 1 });
purchaseReturnSchema.index({ purchase: 1 });
purchaseReturnSchema.index({ createdAt: -1 });
purchaseReturnSchema.index({ number: 1 });

module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
