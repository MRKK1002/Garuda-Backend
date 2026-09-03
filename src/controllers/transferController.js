// Stock transfer controller with the approval workflow:
// requested -> approved -> dispatched -> received (or cancelled/rejected).
//
// Stock effects:
//   dispatch: deduct quantities from the SOURCE showroom's available (ledger transfer_out)
//   receive:  add quantities to the DESTINATION showroom's available (ledger transfer_in)
const Inventory = require("../models/Inventory");
const StockLedger = require("../models/StockLedger");
const StockTransfer = require("../models/StockTransfer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery, assertShowroomAccess } = require("../middleware/showroomScope");

async function getOrCreateStock(product, showroom) {
  let stock = await Inventory.findOne({ product, showroom });
  if (!stock) stock = await Inventory.create({ product, showroom });
  return stock;
}

// GET /api/v1/transfers
const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  // Show transfers that involve any of the user's showrooms (source or destination).
  const scope = scopeQuery(req, "fromShowroom");
  const filter = {};
  if (Object.keys(scope).length) {
    filter.$or = [
      { fromShowroom: scope.fromShowroom },
      { toShowroom: scope.fromShowroom },
    ];
  }
  if (status) filter.status = status;

  const items = await StockTransfer.find(filter)
    .populate("fromShowroom", "name code")
    .populate("toShowroom", "name code")
    .populate("items.product", "name sku")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// POST /api/v1/transfers  { fromShowroom, toShowroom, items:[{product, quantity}], note }
const create = asyncHandler(async (req, res) => {
  const { fromShowroom, toShowroom, items, note } = req.body;
  if (!fromShowroom || !toShowroom) throw new ApiError(400, "fromShowroom and toShowroom are required.");
  if (String(fromShowroom) === String(toShowroom)) {
    throw new ApiError(400, "Source and destination showrooms must differ.");
  }
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, "At least one item is required.");
  assertShowroomAccess(req, fromShowroom);

  const transfer = await StockTransfer.create({
    fromShowroom,
    toShowroom,
    items,
    note,
    requestedBy: req.auth.user._id,
  });
  res.status(201).json({ success: true, item: transfer });
});

// Helper to load a transfer or 404.
async function loadTransfer(id) {
  const t = await StockTransfer.findById(id);
  if (!t) throw new ApiError(404, "Transfer not found.");
  return t;
}

// PATCH /api/v1/transfers/:id/status  { action }
// action: approve | dispatch | receive | cancel | reject
const changeStatus = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const t = await loadTransfer(req.params.id);

  const transitions = {
    approve: { from: "requested", to: "approved" },
    reject: { from: "requested", to: "rejected" },
    dispatch: { from: "approved", to: "dispatched" },
    receive: { from: "dispatched", to: "received" },
    cancel: { from: ["requested", "approved"], to: "cancelled" },
  };

  const rule = transitions[action];
  if (!rule) throw new ApiError(400, `Unknown action: ${action}`);
  const allowedFrom = Array.isArray(rule.from) ? rule.from : [rule.from];
  if (!allowedFrom.includes(t.status)) {
    throw new ApiError(400, `Cannot ${action} a transfer that is '${t.status}'.`);
  }

  // Apply stock effects on dispatch / receive.
  if (action === "dispatch") {
    assertShowroomAccess(req, t.fromShowroom);
    for (const item of t.items) {
      const src = await getOrCreateStock(item.product, t.fromShowroom);
      if (src.available < item.quantity) {
        throw new ApiError(400, "Insufficient stock at source for one or more items.");
      }
    }
    for (const item of t.items) {
      const src = await getOrCreateStock(item.product, t.fromShowroom);
      src.available -= item.quantity;
      await src.save();
      await StockLedger.create({
        product: item.product,
        showroom: t.fromShowroom,
        type: "transfer_out",
        quantity: -item.quantity,
        balance: src.available,
        refType: "StockTransfer",
        refId: t._id,
        createdBy: req.auth.user._id,
      });
    }
  }

  if (action === "receive") {
    for (const item of t.items) {
      const dest = await getOrCreateStock(item.product, t.toShowroom);
      dest.available += item.quantity;
      await dest.save();
      await StockLedger.create({
        product: item.product,
        showroom: t.toShowroom,
        type: "transfer_in",
        quantity: item.quantity,
        balance: dest.available,
        refType: "StockTransfer",
        refId: t._id,
        createdBy: req.auth.user._id,
      });
    }
  }

  t.status = rule.to;
  await t.save();
  res.json({ success: true, item: t });
});

module.exports = { list, create, changeStatus };
