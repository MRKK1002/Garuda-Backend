// Company settings CMS. A singleton document — get() returns it (creating a default
// on first access), update() saves edits, uploadImage() handles logo/signature/QR.
const CompanySettings = require("../models/CompanySettings");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

async function getSingleton() {
  let doc = await CompanySettings.findOne({ key: "company" });
  if (!doc) doc = await CompanySettings.create({ key: "company" });
  return doc;
}

// GET /api/v1/company-settings   (admin)
// GET /api/v1/shop/company        (public — safe subset for the storefront if needed)
const get = asyncHandler(async (req, res) => {
  const doc = await getSingleton();
  res.json({ success: true, item: doc });
});

// PUT /api/v1/company-settings  (admin)
const update = asyncHandler(async (req, res) => {
  const allowed = [
    "logo", "businessName", "phone", "email",
    "billingAddress", "city", "state", "pincode",
    "isGstRegistered", "gstin", "pan", "enableEInvoicing", "enableTds",
    "businessType", "industryType", "registrationType",
    "signature",
    "bankName", "accountHolder", "accountNumber", "ifsc", "branch", "upiId", "customQrImage",
    "extraDetails",
    "invoicePrefix", "invoiceTerms",
  ];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const doc = await CompanySettings.findOneAndUpdate(
    { key: "company" },
    { $set: patch },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, item: doc });
});

// POST /api/v1/company-settings/upload  (multipart field: "image")
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

module.exports = { get, update, uploadImage };
