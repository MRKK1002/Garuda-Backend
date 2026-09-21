// SalesReturn - goods returned BY a customer against a sales invoice (order). On save,
// the returned quantities are ADDED BACK to the fulfilling showroom's stock (opposite
// of a sale). Serial: SRET-0001. The accounting document for this is a Credit Note.
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

const salesReturnSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true }, // SRET-0001

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    showroom: { type: mongoose.Schema.Types.ObjectId, ref: "Showroom", required: true },
    // The sales invoice (order) this return is against (optional but recommended).
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

    items: { type: [returnItemSchema], default: [] },

    returnDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },

    additionalCharges: { type: Number, default: 0 },
    billDiscount: { type: Number, default: 0 },

    subtotal: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // How much has been refunded to the customer.
    amountRefunded: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["unpaid", "partial", "refunded"],
      default: "unpaid",
    },

    // Whether the returned stock has been added back to the showroom.
    stockRestored: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Sales prices are tax-INCLUSIVE (like the sales invoice): GST is decomposed out of
// the line amount rather than added on top.
salesReturnSchema.pre("validate", function computeTotals() {
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

salesReturnSchema.index({ customer: 1 });
salesReturnSchema.index({ showroom: 1 });
salesReturnSchema.index({ order: 1 });
salesReturnSchema.index({ createdAt: -1 });
salesReturnSchema.index({ number: 1 });

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
