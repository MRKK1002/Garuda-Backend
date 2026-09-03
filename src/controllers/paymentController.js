// Payment controller. Recording a payment updates the parent order's amountPaid and
// derived paymentStatus (pending / partial / paid).
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

// GET /api/v1/payments
const list = asyncHandler(async (req, res) => {
  const { order, status } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (order) filter.order = order;
  if (status) filter.status = status;
  const items = await Payment.find(filter)
    .populate("customer", "name")
    .populate("order", "number grandTotal")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// POST /api/v1/payments  { order, amount, mode, reference }
const create = asyncHandler(async (req, res) => {
  const { order: orderId, amount, mode, reference } = req.body;
  const amt = Number(amount);
  if (!orderId) throw new ApiError(400, "order is required.");
  if (!amt || amt <= 0) throw new ApiError(400, "amount must be positive.");

  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  assertShowroomAccess(req, order.showroom);

  const payment = await Payment.create({
    order: order._id,
    customer: order.customer,
    showroom: order.showroom,
    amount: amt,
    mode,
    reference,
    status: "success",
    createdBy: req.auth.user._id,
  });

  // Update order's paid amount + status.
  order.amountPaid = (order.amountPaid || 0) + amt;
  if (order.amountPaid >= order.grandTotal) order.paymentStatus = "paid";
  else if (order.amountPaid > 0) order.paymentStatus = "partial";
  await order.save();

  res.status(201).json({ success: true, item: payment, order: { amountPaid: order.amountPaid, paymentStatus: order.paymentStatus } });
});

module.exports = { list, create };
