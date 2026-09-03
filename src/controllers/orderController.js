// Order controller. Creates orders (optionally from a quotation), lists them (scoped),
// and drives the lifecycle with stock effects:
//   confirm:  reserve stock at the showroom (available -> reserved), mark stockAllocated
//   deliver:  convert reserved -> sold
//   cancel:   release any reserved stock back to available
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Quotation = require("../models/Quotation");
const Payment = require("../models/Payment");
const Delivery = require("../models/Delivery");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

async function nextOrderNumber() {
  const count = await Order.countDocuments();
  return `ORD-${String(count + 1).padStart(6, "0")}`;
}

async function getStock(product, showroom) {
  let s = await Inventory.findOne({ product, showroom });
  if (!s) s = await Inventory.create({ product, showroom });
  return s;
}

// GET /api/v1/orders
const list = asyncHandler(async (req, res) => {
  const { status, customer, showroom } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  if (showroom) {
    assertShowroomAccess(req, showroom);
    filter.showroom = showroom;
  }
  const items = await Order.find(filter)
    .populate("customer", "name mobile")
    .populate("showroom", "name code")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/orders/:id  (with related payments + deliveries for the detail page)
const getOne = asyncHandler(async (req, res) => {
  const item = await Order.findById(req.params.id)
    .populate("customer", "name mobile email")
    .populate("showroom", "name code")
    .populate("items.product", "name sku")
    .lean();
  if (!item) throw new ApiError(404, "Order not found.");

  const [payments, deliveries] = await Promise.all([
    Payment.find({ order: item._id }).sort({ createdAt: -1 }).lean(),
    Delivery.find({ order: item._id }).sort({ createdAt: -1 }).lean(),
  ]);

  res.json({ success: true, item, related: { payments, deliveries } });
});

// POST /api/v1/orders
const create = asyncHandler(async (req, res) => {
  const { customer, showroom, items, salesperson, quotation } = req.body;
  if (!customer || !showroom) throw new ApiError(400, "customer and showroom are required.");
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, "At least one item is required.");
  assertShowroomAccess(req, showroom);

  const number = await nextOrderNumber();
  const order = await Order.create({
    number,
    customer,
    showroom,
    salesperson,
    quotation,
    items,
    createdBy: req.auth.user._id,
  });

  // If created from a quotation, mark it converted.
  if (quotation) {
    await Quotation.findByIdAndUpdate(quotation, { status: "converted" });
  }

  const created = await Order.findById(order._id)
    .populate("customer", "name mobile")
    .populate("showroom", "name code")
    .lean();
  res.status(201).json({ success: true, item: created });
});

// PATCH /api/v1/orders/:id/status  { action }
// action: confirm | process | dispatch | deliver | cancel
const changeStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found.");
  assertShowroomAccess(req, order.showroom);

  const transitions = {
    confirm: { from: "new", to: "confirmed" },
    process: { from: "confirmed", to: "processing" },
    dispatch: { from: "processing", to: "dispatched" },
    deliver: { from: "dispatched", to: "delivered" },
    cancel: { from: ["new", "confirmed", "processing"], to: "cancelled" },
  };
  const rule = transitions[action];
  if (!rule) throw new ApiError(400, `Unknown action: ${action}`);
  const allowedFrom = Array.isArray(rule.from) ? rule.from : [rule.from];
  if (!allowedFrom.includes(order.status)) {
    throw new ApiError(400, `Cannot ${action} an order that is '${order.status}'.`);
  }

  // --- Stock effects ---
  if (action === "confirm" && !order.stockAllocated) {
    // Ensure enough available, then reserve.
    for (const it of order.items) {
      const s = await getStock(it.product, order.showroom);
      if (s.available < it.quantity) {
        throw new ApiError(400, "Insufficient available stock to confirm this order.");
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
        createdBy: req.auth.user._id,
      });
    }
    order.stockAllocated = true;
  }

  if (action === "deliver") {
    // Reserved -> sold.
    for (const it of order.items) {
      const s = await getStock(it.product, order.showroom);
      s.reserved = Math.max(s.reserved - it.quantity, 0);
      s.sold += it.quantity;
      await s.save();
    }
  }

  if (action === "cancel" && order.stockAllocated) {
    // Release reserved back to available.
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
        createdBy: req.auth.user._id,
      });
    }
    order.stockAllocated = false;
  }

  order.status = rule.to;
  await order.save();
  res.json({ success: true, item: order });
});

module.exports = { list, getOne, create, changeStatus };
