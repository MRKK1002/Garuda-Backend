// Return controller. Create a return for an order; on approval, restock the returned
// items (into available) and, if a refundAmount is set, record a refund payment and
// adjust the order's paid amount.
const Return = require("../models/Return");
const Order = require("../models/Order");
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

async function getStock(product, showroom) {
  let s = await Inventory.findOne({ product, showroom });
  if (!s) s = await Inventory.create({ product, showroom });
  return s;
}

async function nextReturnNumber() {
  const count = await Return.countDocuments();
  return `RET-${String(count + 1).padStart(6, "0")}`;
}

// GET /api/v1/returns
const list = asyncHandler(async (req, res) => {
  const { status, order } = req.query;
  const filter = { ...scopeQuery(req, "showroom") };
  if (status) filter.status = status;
  if (order) filter.order = order;
  const items = await Return.find(filter)
    .populate("order", "number")
    .populate("customer", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// POST /api/v1/returns  { order, items:[{product,name,quantity}], reason, refundAmount }
const create = asyncHandler(async (req, res) => {
  const { order: orderId, items, reason, refundAmount } = req.body;
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found.");
  if (order.status !== "delivered") throw new ApiError(400, "Only delivered orders can be returned.");
  assertShowroomAccess(req, order.showroom);

  const number = await nextReturnNumber();
  const ret = await Return.create({
    number,
    order: order._id,
    customer: order.customer,
    showroom: order.showroom,
    items: items && items.length ? items : order.items.map((i) => ({ product: i.product, name: i.name, quantity: i.quantity })),
    reason,
    refundAmount: Number(refundAmount) || 0,
    createdBy: req.auth.user._id,
  });
  res.status(201).json({ success: true, item: ret });
});

// PATCH /api/v1/returns/:id/status  { action }  action: approve | reject | refund
const changeStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const ret = await Return.findById(req.params.id);
  if (!ret) throw new ApiError(404, "Return not found.");
  assertShowroomAccess(req, ret.showroom);

  if (action === "reject") {
    if (ret.status !== "requested") throw new ApiError(400, "Only requested returns can be rejected.");
    ret.status = "rejected";
    await ret.save();
    return res.json({ success: true, item: ret });
  }

  if (action === "approve") {
    if (ret.status !== "requested") throw new ApiError(400, "Only requested returns can be approved.");
    // Restock returned items into available.
    for (const it of ret.items) {
      const s = await getStock(it.product, ret.showroom);
      s.available += it.quantity;
      s.sold = Math.max((s.sold || 0) - it.quantity, 0);
      await s.save();
      await StockLedger.create({
        product: it.product,
        showroom: ret.showroom,
        type: "adjustment",
        quantity: it.quantity,
        balance: s.available,
        note: `Return ${ret.number} restock`,
        refType: "Return",
        refId: ret._id,
        createdBy: req.auth.user._id,
      });
    }
    ret.status = "approved";
    await ret.save();
    return res.json({ success: true, item: ret });
  }

  if (action === "refund") {
    if (ret.status !== "approved") throw new ApiError(400, "Approve the return before refunding.");
    if (ret.refundAmount > 0) {
      await Payment.create({
        order: ret.order,
        customer: ret.customer,
        showroom: ret.showroom,
        amount: ret.refundAmount,
        mode: "other",
        reference: `Refund for ${ret.number}`,
        status: "refunded",
        createdBy: req.auth.user._id,
      });
      // Reduce the order's paid amount + mark refunded.
      const order = await Order.findById(ret.order);
      if (order) {
        order.amountPaid = Math.max((order.amountPaid || 0) - ret.refundAmount, 0);
        order.paymentStatus = "refunded";
        await order.save();
      }
    }
    ret.status = "refunded";
    await ret.save();
    return res.json({ success: true, item: ret });
  }

  throw new ApiError(400, `Unknown action: ${action}`);
});

module.exports = { list, create, changeStatus };
