// Target controller. Set/list targets for a showroom and compute performance
// (achieved sales vs target) for a given period.
const Target = require("../models/Target");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { assertShowroomAccess } = require("../middleware/showroomScope");

// Convert a period string ("2026-09" or "2026") into a date range.
function periodRange(period) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
  }
  if (/^\d{4}$/.test(period)) {
    const y = Number(period);
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
  }
  return null;
}

// GET /api/v1/showrooms/:id/targets
const listForShowroom = asyncHandler(async (req, res) => {
  assertShowroomAccess(req, req.params.id);
  const items = await Target.find({ showroom: req.params.id }).sort({ period: -1 }).lean();

  // Attach achieved sales per period.
  const withPerf = await Promise.all(
    items.map(async (t) => {
      const range = periodRange(t.period);
      let achieved = 0;
      if (range) {
        const [agg] = await Order.aggregate([
          {
            $match: {
              showroom: t.showroom,
              status: { $ne: "cancelled" },
              createdAt: { $gte: range.start, $lte: range.end },
            },
          },
          { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]);
        achieved = agg?.total || 0;
      }
      return {
        ...t,
        achieved,
        percent: t.amount > 0 ? Math.round((achieved / t.amount) * 100) : 0,
      };
    })
  );

  res.json({ success: true, items: withPerf });
});

// POST /api/v1/showrooms/:id/targets  { period, amount, note }
const setTarget = asyncHandler(async (req, res) => {
  assertShowroomAccess(req, req.params.id);
  const { period, amount, note } = req.body;
  if (!period || amount === undefined) throw new ApiError(400, "period and amount are required.");

  // Upsert by showroom+period.
  const target = await Target.findOneAndUpdate(
    { showroom: req.params.id, period },
    { amount: Number(amount) || 0, note },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ success: true, item: target });
});

module.exports = { listForShowroom, setTarget };
