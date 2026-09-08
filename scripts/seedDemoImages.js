// One-off: attach a category-appropriate Unsplash image to demo products that have no
// image yet. Temporary stock photos - replace with real product images later via admin.
// Run: node scripts/seedDemoImages.js
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");

// A relevant stock image per category (Unsplash, fixed photo IDs so they're stable).
const IMAGE_BY_CATEGORY = {
  "air conditoner": "https://images.unsplash.com/photo-1631545806609-24b2f3a03f80?w=600&q=80",
  mattress: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80",
  refrigerator: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&q=80",
  tv: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80",
  "washing machine": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&q=80",
};

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log("Connected.");

  const cats = await Category.find().lean();
  const catNameById = Object.fromEntries(cats.map((c) => [String(c._id), c.name.toLowerCase()]));

  const products = await Product.find().lean();
  let updated = 0;
  for (const p of products) {
    // Only set an image if the product doesn't already have one.
    if (Array.isArray(p.images) && p.images.length > 0) continue;
    const catName = catNameById[String(p.category)];
    const url = IMAGE_BY_CATEGORY[catName];
    if (!url) continue;
    await Product.updateOne({ _id: p._id }, { $set: { images: [url] } });
    updated += 1;
  }

  console.log(`Images set on ${updated} products.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
