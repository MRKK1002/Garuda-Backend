// CompanySettings — a singleton document holding the business profile used across
// the CRM, especially on printed GST tax invoices (logo, GSTIN, PAN, address, bank
// details, UPI). Admin edits it in Settings; the invoice reads it.
const mongoose = require("mongoose");

const companySettingsSchema = new mongoose.Schema(
  {
    // Singleton guard — always "company" so only one document can exist.
    key: { type: String, default: "company", unique: true },

    // Identity
    logo:         { type: String, trim: true, default: "" }, // /uploads path
    businessName: { type: String, trim: true, default: "Garuda International" },
    phone:        { type: String, trim: true, default: "" },
    email:        { type: String, trim: true, default: "" },

    // Address
    billingAddress: { type: String, trim: true, default: "" },
    city:           { type: String, trim: true, default: "" },
    state:          { type: String, trim: true, default: "Karnataka" },
    pincode:        { type: String, trim: true, default: "" },

    // Tax / registration
    isGstRegistered: { type: Boolean, default: false },
    gstin:           { type: String, trim: true, uppercase: true, default: "" },
    pan:             { type: String, trim: true, uppercase: true, default: "" },
    enableEInvoicing:{ type: Boolean, default: false },
    enableTds:       { type: Boolean, default: false },
    businessType:    { type: String, trim: true, default: "" },
    industryType:    { type: String, trim: true, default: "" },
    registrationType:{ type: String, trim: true, default: "" },

    // Invoice signature
    signature: { type: String, trim: true, default: "" }, // /uploads path

    // Bank & payment (printed on invoice footer)
    bankName:      { type: String, trim: true, default: "" },
    accountHolder: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifsc:          { type: String, trim: true, default: "" },
    branch:        { type: String, trim: true, default: "" },
    upiId:         { type: String, trim: true, default: "" },
    customQrImage: { type: String, trim: true, default: "" }, // /uploads path (optional override)

    // Extra freeform business details [{ key, value }]
    extraDetails: {
      type: [{ key: String, value: String, _id: false }],
      default: [],
    },

    // Invoice preferences
    invoicePrefix: { type: String, trim: true, default: "INV" },
    invoiceTerms:  { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanySettings", companySettingsSchema);
