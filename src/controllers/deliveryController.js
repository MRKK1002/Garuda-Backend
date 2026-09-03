// Delivery controller. Create/schedule a delivery for an order and update its status.
const Delivery = require("../models/Delivery");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

// GET /api/v1/deliveries
const list = asyncHandler(async (req, res) => {
  const { status, order } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (status) filter.status = status;
  if (order) filter.order = order;
  const items = await Delivery.find(filter)
    .populate("order", "number")
    .populate("customer", "name mobile")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// POST /api/v1/deliveries  { order, scheduledDate, address, note }
const create = asyncHandler(async (req, res) => {
  const { order: orderId, scheduledDate, address, note } = req.body;
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  assertShowroomAccess(req, order.showroom);

  const delivery = await Delivery.create({
    order: order._id,
    customer: order.customer,
    showroom: order.showroom,
    scheduledDate,
    address,
    note,
    status: scheduledDate ? "scheduled" : "pending",
  });
  res.status(201).json({ success: true, item: delivery });
});

// PATCH /api/v1/deliveries/:id  { status, scheduledDate, note }
const update = asyncHandler(async (req, res) => {
  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) throw new ApiError(404, "Delivery not found.");
  assertShowroomAccess(req, delivery.showroom);
  ["status", "scheduledDate", "address", "note", "assignedTo"].forEach((f) => {
    if (req.body[f] !== undefined) delivery[f] = req.body[f];
  });
  await delivery.save();
  res.json({ success: true, item: delivery });
});

module.exports = { list, create, update };
