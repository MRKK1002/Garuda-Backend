// Dashboard controller - aggregates KPIs and recent activity across modules, scoped to
// the user's showrooms where relevant.
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Order = require("../models/Order");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

// GET /api/v1/dashboard/stats
const stats = asyncHandler(async (req, res) => {
  const custScope = scopeQuery(req, "assignedShowroom");
  const leadScope = scopeQuery(req, "showroom");
  const orderScope = scopeQuery(req, "showroom");
  const invScope = scopeQuery(req, "showroom");

  const [
    customerCount,
    leadCount,
    productCount,
    orderCount,
    leadsByStageAgg,
    salesAgg,
    lowStockList,
    recentOrders,
    recentLeads,
  ] = await Promise.all([
    Customer.countDocuments(custScope),
    Lead.countDocuments(leadScope),
    Product.countDocuments({}),
    Order.countDocuments(orderScope),
    Lead.aggregate([
      ...(Object.keys(leadScope).length ? [{ $match: leadScope }] : []),
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    // Total sales = sum of grandTotal for non-cancelled orders.
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" }, ...orderScope } },
      { $group: { _id: null, total: { $sum: "$grandTotal" }, paid: { $sum: "$amountPaid" } } },
    ]),
    // Low-stock items (available <= minStock).
    Inventory.find({ ...invScope, $expr: { $lte: ["$available", "$minStock"] } })
      .populate("product", "name sku")
      .populate("showroom", "code")
      .limit(10)
      .lean(),
    Order.find(orderScope)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Lead.find(leadScope)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const leadsByStage = leadsByStageAgg.reduce((acc, r) => {
    acc[r._id] = r.count;
    return acc;
  }, {});

  const sales = salesAgg[0] || { total: 0, paid: 0 };
  const pendingPayments = Math.max((sales.total || 0) - (sales.paid || 0), 0);

  res.json({
    success: true,
    stats: {
      customers: customerCount,
      leads: leadCount,
      products: productCount,
      orders: orderCount,
      totalSales: sales.total || 0,
      pendingPayments,
      lowStockCount: lowStockList.length,
      leadsByStage,
    },
    lowStock: lowStockList,
    recentOrders,
    recentLeads,
  });
});

module.exports = { stats };
