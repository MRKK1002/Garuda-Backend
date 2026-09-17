// Customer CRUD. List supports search + segment/status filters, scoped to the user's
// assigned showrooms.
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const Quotation = require("../models/Quotation");
const Showroom = require("../models/Showroom");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Delivery = require("../models/Delivery");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { scopeQuery } = require("../middleware/showroomScope");

// A scoped user may touch a customer if it's assigned to one of their showrooms,
// or if it's unassigned (shared pool — e.g. website customers). Super Admin: always.
function assertCustomerAccess(req, customer) {
  const { isSuperAdmin, showroomIds } = req.auth;
  if (isSuperAdmin) return;
  const assigned = customer.assignedShowroom?._id || customer.assignedShowroom;
  if (!assigned) return; // unassigned customers are shared
  if (showroomIds.length === 0 || !showroomIds.includes(String(assigned))) {
    throw new ApiError(403, "You do not have access to this customer.");
  }
}

// GET /api/v1/customers
const list = asyncHandler(async (req, res) => {
  const { q, segment, status } = req.query;
  const filter = { ...scopeQuery(req, "assignedShowroom") };
  if (segment) filter.segment = segment;
  if (status) filter.status = status;
  if (q) {
    filter.$or = [
      { name: new RegExp(q, "i") },
      { mobile: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
    ];
  }
  const items = await Customer.find(filter)
    .populate("assignedShowroom", "name code")
    .populate("assignedSalesperson", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/customers/:id  (with related leads + quotations for Customer 360)
const getOne = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id)
    .populate("assignedShowroom", "name code")
    .populate("assignedSalesperson", "name")
    .lean();
  if (!customer) throw new ApiError(404, "Customer not found.");
  assertCustomerAccess(req, customer);

  const [leads, quotations, orders, payments, deliveries] = await Promise.all([
    Lead.find({ customer: customer._id }).populate("product", "name").sort({ createdAt: -1 }).lean(),
    Quotation.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
    Order.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
    Payment.find({ customer: customer._id }).populate("order", "number").sort({ createdAt: -1 }).lean(),
    Delivery.find({ customer: customer._id }).populate("order", "number").sort({ createdAt: -1 }).lean(),
  ]);

  res.json({
    success: true,
    item: customer,
    related: { leads, quotations, orders, payments, deliveries },
  });
});

// POST /api/v1/customers
const create = asyncHandler(async (req, res) => {
  const customer = await Customer.create({ source: "crm", ...req.body });
  res.status(201).json({ success: true, item: customer });
});

// PUT /api/v1/customers/:id
const update = asyncHandler(async (req, res) => {
  const existing = await Customer.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Customer not found.");
  assertCustomerAccess(req, existing);

  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.json({ success: true, item: customer });
});

// DELETE /api/v1/customers/:id
const remove = asyncHandler(async (req, res) => {
  const existing = await Customer.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Customer not found.");
  assertCustomerAccess(req, existing);

  await Customer.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// POST /api/v1/customers/bulk
// Body: { rows: [{ name, mobile, email, city, state, segment, showroomCode }] }
// Upsert by mobile. showroomCode (optional) resolves to assignedShowroom.
const bulkUpsert = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) throw new ApiError(400, "No rows provided.");
  if (rows.length > 5000) throw new ApiError(400, "Too many rows (max 5000).");

  const showroomCache = new Map();
  async function resolveShowroom(code) {
    if (!code) return undefined;
    const key = String(code).trim().toUpperCase();
    if (showroomCache.has(key)) return showroomCache.get(key);
    const doc = await Showroom.findOne({ code: key });
    showroomCache.set(key, doc ? doc._id : null);
    return doc ? doc._id : null;
  }

  const results = { created: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.name || !r.mobile) throw new Error("name and mobile are required");
      const payload = {
        name: r.name,
        email: r.email,
        city: r.city,
        state: r.state,
        segment: r.segment || "new",
        source: "crm",
      };
      if (r.showroomCode) {
        const sid = await resolveShowroom(r.showroomCode);
        if (sid === null) throw new Error(`Unknown showroom code: ${r.showroomCode}`);
        payload.assignedShowroom = sid;
      }

      const mobile = String(r.mobile).trim();
      const existing = await Customer.findOne({ mobile });
      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        results.updated += 1;
      } else {
        await Customer.create({ ...payload, mobile });
        results.created += 1;
      }
    } catch (err) {
      results.failed += 1;
      results.errors.push({ row: i + 1, mobile: r.mobile, message: err.message });
    }
  }

  res.json({ success: true, results });
});

module.exports = { list, getOne, create, update, remove, bulkUpsert };
