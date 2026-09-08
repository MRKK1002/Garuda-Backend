// One-off script: seed ~5 demo products per category so the storefront looks populated.
// Run:  node scripts/seedDemoProducts.js
// Safe to re-run: it upserts by SKU (won't create duplicates).
require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to", env.mongoUri);

  const cats = await Category.find().lean();
  const brands = await Brand.find().lean();
  const catByName = Object.fromEntries(cats.map((c) => [c.name.toLowerCase(), c._id]));
  const brandByName = Object.fromEntries(brands.map((b) => [b.name.toLowerCase(), b._id]));

  // Pick a brand id by preferred name, falling back to any brand.
  const anyBrand = brands[0]?._id;
  const brand = (name) => brandByName[name.toLowerCase()] || anyBrand;

  // 5 products per category. [category, [ {name, brand, mrp, sell, flags} ] ]
  const data = {
    "air conditoner": [
      ["LG 1.5 Ton 5 Star Split AC", "Lg", 52000, 46990, { isFeatured: true }],
      ["Midea 1 Ton 3 Star Window AC", "Midea", 32000, 27990, { isNewArrival: true }],
      ["Toshiba 1.5 Ton Inverter AC", "Toshiba", 55000, 49990, { isBestseller: true }],
      ["LG 2 Ton 3 Star Split AC", "Lg", 62000, 55990, {}],
      ["Midea 1.5 Ton 5 Star Inverter AC", "Midea", 49000, 43990, {}],
    ],
    mattress: [
      ["Orthopedic Memory Foam Mattress (Queen)", "Midea", 28000, 21990, { isFeatured: true }],
      ["Pocket Spring Mattress (King)", "Toshiba", 35000, 27990, {}],
      ["Dual Comfort Foam Mattress (Single)", "Lg", 12000, 8990, { isNewArrival: true }],
      ["Latex Premium Mattress (Queen)", "Midea", 42000, 33990, { isBestseller: true }],
      ["Bonnell Spring Mattress (Double)", "Toshiba", 18000, 13990, {}],
    ],
    refrigerator: [
      ["LG 260L Double Door Refrigerator", "Lg", 32000, 27990, { isFeatured: true }],
      ["Toshiba 190L Single Door Fridge", "Toshiba", 18000, 15990, {}],
      ["Midea 340L Frost Free Refrigerator", "Midea", 40000, 34990, { isBestseller: true }],
      ["LG 630L Side-by-Side Refrigerator", "Lg", 95000, 82990, { isNewArrival: true }],
      ["Toshiba 240L Double Door Fridge", "Toshiba", 30000, 25990, {}],
    ],
    tv: [
      ["LG 43 inch 4K Smart TV", "Lg", 48000, 38990, { isFeatured: true }],
      ["Toshiba 55 inch QLED 4K TV", "Toshiba", 70000, 56990, { isBestseller: true }],
      ["Midea 32 inch HD Smart TV", "Midea", 22000, 15990, { isNewArrival: true }],
      ["LG 65 inch OLED 4K TV", "Lg", 180000, 154990, {}],
      ["Toshiba 43 inch Full HD TV", "Toshiba", 40000, 32990, {}],
    ],
    "washing machine": [
      ["LG 7kg Front Load Washing Machine", "Lg", 42000, 35990, { isFeatured: true }],
      ["Toshiba 8kg Front Load Washer", "Toshiba", 46000, 39990, { isBestseller: true }],
      ["Midea 6.5kg Semi Automatic Washer", "Midea", 16000, 11990, { isNewArrival: true }],
      ["LG 9kg Fully Automatic Top Load", "Lg", 38000, 32990, {}],
      ["Toshiba 7kg Top Load Washing Machine", "Toshiba", 30000, 24990, {}],
    ],
  };

  let created = 0;
  for (const [catName, products] of Object.entries(data)) {
    const category = catByName[catName];
    if (!category) {
      console.warn(`Skipping unknown category: ${catName}`);
      continue;
    }
    for (const [name, brandName, mrp, sell, flags] of products) {
      const sku = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      const res = await Product.updateOne(
        { sku },
        {
          $setOnInsert: {
            name,
            sku,
            category,
            brand: brand(brandName),
            mrp,
            sellingPrice: sell,
            gst: 18,
            status: "active",
            ...flags,
          },
        },
        { upsert: true }
      );
      if (res.upsertedCount) created += 1;
    }
  }

  console.log(`Done. Newly created products: ${created}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
