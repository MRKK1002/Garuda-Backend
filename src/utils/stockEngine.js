// Shared stock engine — the single source of truth for how order stock moves through
// inventory. Used by both the CRM order controller and the storefront checkout so the
// behaviour is identical everywhere.
//
// Buckets on an Inventory (product+showroom) record:
//   available → reserved → sold        (normal sale path)
//   reserved  → available              (on cancel)
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Showroom = require("../models/Showroom");

async function getStock(product, showroom) {
  let s = await Inventory.findOne({ product, showroom });
  if (!s) s = await Inventory.create({ product, showroom });
  return s;
}

// Does a showroom have enough AVAILABLE stock for every line of an order?
async function showroomHasStock(showroomId, items) {
  for (const it of items) {
    const s = await Inventory.findOne({ product: it.product, showroom: showroomId }).lean();
    const avail = s?.available || 0;
    if (avail < (it.quantity || 0)) return false;
  }
  return true;
}

// Reserve stock for an order at its showroom: available -= qty, reserved += qty.
// Writes a ledger row per line. Throws if any line lacks available stock.
async function reserveStock(order, userId) {
  // Pre-check all lines first (fail before mutating anything).
  for (const it of order.items) {
    const s = await getStock(it.product, order.showroom);
    if (s.available < it.quantity) {
      throw Object.assign(new Error("Insufficient available stock to reserve this order."), { statusCode: 400 });
    }
  }
  for (const it of order.items) {
    const s = await getStock(it.product, order.showroom);
    s.available -= it.quantity;
    s.reserved += it.quantity;
    await s.save();
    await StockLedger.create({
      product: it.product,
      showroom: order.showroom,
      type: "outward",
      quantity: -it.quantity,
      balance: s.available,
      note: `Reserved for order ${order.number}`,
      refType: "Order",
      refId: order._id,
      createdBy: userId || null,
    });
  }
}

// Convert reserved → sold on delivery.
async function fulfillStock(order, userId) {
  for (const it of order.items) {
    const s = await getStock(it.product, order.showroom);
    s.reserved = Math.max(s.reserved - it.quantity, 0);
    s.sold += it.quantity;
    await s.save();
    await StockLedger.create({
      product: it.product,
      showroom: order.showroom,
      type: "outward",
      quantity: 0,
      balance: s.available,
      note: `Delivered order ${order.number}`,
      refType: "Order",
      refId: order._id,
      createdBy: userId || null,
    });
  }
}

// Release reserved → available on cancel.
async function releaseStock(order, userId) {
  for (const it of order.items) {
    const s = await getStock(it.product, order.showroom);
    s.reserved = Math.max(s.reserved - it.quantity, 0);
    s.available += it.quantity;
    await s.save();
    await StockLedger.create({
      product: it.product,
      showroom: order.showroom,
      type: "adjustment",
      quantity: it.quantity,
      balance: s.available,
      note: `Released from cancelled order ${order.number}`,
      refType: "Order",
      refId: order._id,
      createdBy: userId || null,
    });
  }
}

// Pick the best showroom to fulfil an online order.
//  1. Prefer the showroom NEAREST to the customer that has full stock.
//  2. If we have no customer coords, prefer any active showroom with full stock.
//  3. If no showroom has full stock, fall back to the nearest/first active showroom
//     (order will be created "pending assignment" — stock not reserved).
// Returns { showroomId, hasStock }.
async function pickOnlineShowroom(customer, items) {
  const notWarehouse = { type: { $ne: "warehouse" }, status: "active" };
  const showrooms = await Showroom.find(notWarehouse).select("_id lat lng").lean();
  if (showrooms.length === 0) return { showroomId: null, hasStock: false };

  const custLat = customer?.lat;
  const custLng = customer?.lng;

  // Distance helper (Haversine, km). Returns Infinity if we can't compute.
  const dist = (s) => {
    if (custLat == null || custLng == null || s.lat == null || s.lng == null) return Infinity;
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(s.lat - custLat);
    const dLng = toRad(s.lng - custLng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(custLat)) * Math.cos(toRad(s.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  // Sort showrooms by distance (nearest first; unknown distances go last).
  const sorted = [...showrooms].sort((a, b) => dist(a) - dist(b));

  // First pass: nearest showroom that has FULL stock for all items.
  for (const s of sorted) {
    if (await showroomHasStock(s._id, items)) {
      return { showroomId: s._id, hasStock: true };
    }
  }

  // Fallback: nearest/first active showroom, no full stock (needs manual handling).
  return { showroomId: sorted[0]._id, hasStock: false };
}

module.exports = {
  getStock,
  showroomHasStock,
  reserveStock,
  fulfillStock,
  releaseStock,
  pickOnlineShowroom,
};
