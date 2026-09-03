// Reports controller - aggregation endpoints for the reporting module. Each report is
// scoped to the user's showrooms where relevant, and supports an optional date range
// (?from=&to=) on created records.
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const Inventory = require("../models/Inventory");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

// Build a createdAt filter from ?from=&to=.
function dateRange(req) {
  const { from, to } = req.query;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? { createdAt: range } : {};
}

// GET /api/v1/reports/sales  -> totals + sales grouped by showroom
const sales = asyncHandler(async (req, res) => {
  const match = { status: { $ne: "cancelled" }, ...scopeQuery(req, "showroom"), ...dateRange(req) };

  const [totals] = await Order.aggregate([
    { $match: match },
    { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$grandTotal" }, collected: { $sum: "$amountPaid" } } },
  ]);

  const byShowroom = await Order.aggregate([
    { $match: match },
    { $group: { _id: "$showroom", orders: { $sum: 1 }, revenue: { $sum: "$grandTotal" } } },
    { $lookup: { from: "showrooms", localField: "_id", foreignField: "_id", as: "showroom" } },
    { $unwind: { path: "$showroom", preserveNullAndEmptyArrays: true } },
    { $project: { showroom: "$showroom.name", code: "$showroom.code", orders: 1, revenue: 1 } },
    { $sort: { revenue: -1 } },
  ]);

  res.json({
    success: true,
    report: "sales",
    totals: totals || { orders: 0, revenue: 0, collected: 0 },
    rows: byShowroom,
  });
});

// GET /api/v1/reports/leads  -> leads grouped by stage and by source
const leads = asyncHandler(async (req, res) => {
  const match = { ...scopeQuery(req, "showroom"), ...dateRange(req) };
  const byStage = await Lead.aggregate([
    { $match: match },
    { $group: { _id: "$stage", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const bySource = await Lead.aggregate([
    { $match: match },
    { $group: { _id: "$source", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  res.json({ success: true, report: "leads", byStage, bySource });
});

// GET /api/v1/reports/payments  -> payment totals by mode + status
const payments = asyncHandler(async (req, res) => {
  const match = { ...scopeQuery(req, "showroom"), ...dateRange(req) };
  const byMode = await Payment.aggregate([
    { $match: match },
    { $group: { _id: "$mode", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { amount: -1 } },
  ]);
  const [totals] = await Payment.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  res.json({ success: true, report: "payments", totals: totals || { amount: 0, count: 0 }, byMode });
});

// GET /api/v1/reports/inventory  -> stock valuation + low stock count (showroom-scoped)
const inventory = asyncHandler(async (req, res) => {
  const match = { ...scopeQuery(req, "showroom") };
  const rows = await Inventory.aggregate([
    { $match: match },
    { $group: { _id: "$showroom", available: { $sum: "$available" }, reserved: { $sum: "$reserved" }, sold: { $sum: "$sold" }, damaged: { $sum: "$damaged" } } },
    { $lookup: { from: "showrooms", localField: "_id", foreignField: "_id", as: "showroom" } },
    { $unwind: { path: "$showroom", preserveNullAndEmptyArrays: true } },
    { $project: { showroom: "$showroom.name", code: "$showroom.code", available: 1, reserved: 1, sold: 1, damaged: 1 } },
    { $sort: { available: -1 } },
  ]);
  res.json({ success: true, report: "inventory", rows });
});

// GET /api/v1/reports/customers -> counts by segment + total
const customers = asyncHandler(async (req, res) => {
  const match = { ...scopeQuery(req, "assignedShowroom"), ...dateRange(req) };
  const bySegment = await Customer.aggregate([
    { $match: match },
    { $group: { _id: "$segment", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = await Customer.countDocuments(match);
  res.json({ success: true, report: "customers", total, bySegment });
});

module.exports = { sales, leads, payments, inventory, customers };
