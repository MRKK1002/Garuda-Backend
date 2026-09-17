// About page CMS. A singleton document — get() returns it (creating a default on
// first access), update() saves edits, uploadImage() handles image uploads.
const AboutContent = require("../models/AboutContent");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Find-or-create the single About document.
async function getSingleton() {
  let doc = await AboutContent.findOne({ key: "about" });
  if (!doc) doc = await AboutContent.create({ key: "about" });
  return doc;
}

// GET /api/v1/about   (admin) — full editable content
// GET /api/v1/shop/about (public) — same shape, no auth
const get = asyncHandler(async (req, res) => {
  const doc = await getSingleton();
  res.json({ success: true, item: doc });
});

// PUT /api/v1/about  (admin)
const update = asyncHandler(async (req, res) => {
  const allowed = [
    "aboutTitle", "aboutBody", "aboutImage",
    "storyHeading", "storyBadge", "storyBody", "storyImage",
    "vision", "mission",
  ];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const doc = await AboutContent.findOneAndUpdate(
    { key: "about" },
    { $set: patch },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, item: doc });
});

// POST /api/v1/about/upload  (multipart field: "image")
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded.");
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}` });
});

module.exports = { get, update, uploadImage };
