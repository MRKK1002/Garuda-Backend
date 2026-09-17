// Payment controller. Recording a payment updates the parent order's amountPaid and
// derived paymentStatus (pending / partial / paid).
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");
const Counter = require("../models/Counter");

// Next payment-in serial, starting from 1: PAY-0001, PAY-0002, ...
async function nextPaymentNumber() {
  const seq = await Counter.nextSeq("payment");
  return `PAY-${String(seq).padStart(4, "0")}`;
}

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

  // Guard against overpayment: a payment can never exceed the outstanding balance.
  const balanceDue = Math.max((order.grandTotal || 0) - (order.amountPaid || 0), 0);
  if (balanceDue <= 0) {
    throw new ApiError(400, "This invoice is already fully paid.");
  }
  if (amt > balanceDue) {
    throw new ApiError(
      400,
      `Amount cannot exceed the outstanding balance of ${balanceDue.toFixed(2)}.`
    );
  }

  const number = await nextPaymentNumber();
  const payment = await Payment.create({
    number,
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

// GET /api/v1/payments/outstanding?customer=<id>
// Returns the customer's open (unpaid / partially paid) orders with the balance due
// on each, plus the total outstanding. Used by the "Payment In" settlement screen.
const outstanding = asyncHandler(async (req, res) => {
  const { customer } = req.query;
  if (!customer) throw new ApiError(400, "customer is required.");

  const filter = {
    ...scopeQuery(req, "showroom"),
    customer,
    status: { $ne: "cancelled" },
    $expr: { $gt: ["$grandTotal", "$amountPaid"] },
  };

  const orders = await Order.find(filter)
    .select("number grandTotal amountPaid createdAt dueDate status paymentStatus")
    .sort({ createdAt: 1 })
    .lean();

  const items = orders.map((o) => ({
    _id: o._id,
    number: o.number,
    createdAt: o.createdAt,
    dueDate: o.dueDate,
    grandTotal: o.grandTotal || 0,
    amountPaid: o.amountPaid || 0,
    balance: Math.max((o.grandTotal || 0) - (o.amountPaid || 0), 0),
  }));

  const totalOutstanding = items.reduce((s, o) => s + o.balance, 0);

  res.json({ success: true, items, totalOutstanding });
});

// POST /api/v1/payments/settle
// Body: { customer, mode, reference, date, allocations: [{ order, amount }] }
// Records one Payment per allocated order and updates each order's paid amount +
// status. Each allocation is validated against that order's outstanding balance.
const settle = asyncHandler(async (req, res) => {
  const { customer, mode, reference, date, allocations } = req.body;
  if (!customer) throw new ApiError(400, "customer is required.");
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new ApiError(400, "At least one invoice allocation is required.");
  }

  // Load and validate every order up front so we don't record partial results.
  const prepared = [];
  for (const alloc of allocations) {
    const amt = Number(alloc.amount);
    if (!amt || amt <= 0) continue; // skip zero allocations
    const order = await Order.findById(alloc.order);
    if (!order) throw new ApiError(404, `Order ${alloc.order} not found.`);
    assertShowroomAccess(req, order.showroom);
    if (String(order.customer) !== String(customer)) {
      throw new ApiError(400, `Order ${order.number} does not belong to this party.`);
    }
    const balanceDue = Math.max((order.grandTotal || 0) - (order.amountPaid || 0), 0);
    if (amt > balanceDue) {
      throw new ApiError(
        400,
        `Amount ${amt.toFixed(2)} exceeds the balance ${balanceDue.toFixed(2)} on invoice ${order.number}.`
      );
    }
    prepared.push({ order, amt });
  }

  if (prepared.length === 0) throw new ApiError(400, "No valid allocations to record.");

  // One payment-in number for the whole settlement (shared across each invoice row).
  const number = await nextPaymentNumber();
  const createdPayments = [];
  for (const { order, amt } of prepared) {
    const payment = await Payment.create({
      number,
      order: order._id,
      customer: order.customer,
      showroom: order.showroom,
      amount: amt,
      mode: mode || "cash",
      reference,
      status: "success",
      createdBy: req.auth.user._id,
      ...(date ? { createdAt: new Date(date) } : {}),
    });
    order.amountPaid = (order.amountPaid || 0) + amt;
    if (order.amountPaid >= order.grandTotal) order.paymentStatus = "paid";
    else if (order.amountPaid > 0) order.paymentStatus = "partial";
    await order.save();
    createdPayments.push(payment);
  }

  const totalRecorded = prepared.reduce((s, p) => s + p.amt, 0);
  res.status(201).json({
    success: true,
    number,
    count: createdPayments.length,
    totalRecorded,
    items: createdPayments,
  });
});

module.exports = { list, create, outstanding, settle };
