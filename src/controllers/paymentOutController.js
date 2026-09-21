// Payment Out controller — money paid TO suppliers against purchase invoices. Mirror
// of the Payment In flow, but for Purchase + supplier instead of Order + customer.
const PurchasePayment = require("../models/PurchasePayment");
const Purchase = require("../models/Purchase");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Next payment-out serial, starting from 1: PAYOUT-0001, PAYOUT-0002, ...
async function nextPaymentOutNumber() {
  const seq = await Counter.nextSeq("payment_out");
  return `PAYOUT-${String(seq).padStart(4, "0")}`;
}

// Apply a payment to a purchase invoice: bump amountPaid + derive status.
function applyToPurchase(purchase, amt) {
  purchase.amountPaid = (purchase.amountPaid || 0) + amt;
  if (purchase.amountPaid >= purchase.grandTotal && purchase.grandTotal > 0) purchase.paymentStatus = "paid";
  else if (purchase.amountPaid > 0) purchase.paymentStatus = "partial";
  else purchase.paymentStatus = "unpaid";
}

// GET /api/v1/payments-out  (list of recorded payments-out)
const list = asyncHandler(async (req, res) => {
  const { supplier } = req.query;
  const filter = {};
  if (supplier) filter.supplier = supplier;
  const items = await PurchasePayment.find(filter)
    .populate("supplier", "name")
    .populate("purchase", "number grandTotal")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, items });
});

// GET /api/v1/payments-out/outstanding?supplier=<id>
// The supplier's open (unpaid/partial) purchase invoices with balance due on each.
const outstanding = asyncHandler(async (req, res) => {
  const { supplier } = req.query;
  if (!supplier) throw new ApiError(400, "supplier is required.");

  const purchases = await Purchase.find({
    supplier,
    $expr: { $gt: ["$grandTotal", "$amountPaid"] },
  })
    .select("number grandTotal amountPaid invoiceDate dueDate createdAt originalInvoiceNo paymentStatus")
    .sort({ createdAt: 1 })
    .lean();

  const items = purchases.map((p) => ({
    _id: p._id,
    number: p.number,
    originalInvoiceNo: p.originalInvoiceNo,
    createdAt: p.invoiceDate || p.createdAt,
    dueDate: p.dueDate,
    grandTotal: p.grandTotal || 0,
    amountPaid: p.amountPaid || 0,
    balance: Math.max((p.grandTotal || 0) - (p.amountPaid || 0), 0),
  }));

  const totalOutstanding = items.reduce((s, p) => s + p.balance, 0);
  res.json({ success: true, items, totalOutstanding });
});

// POST /api/v1/payments-out/settle
// Body: { supplier, mode, reference, date, allocations: [{ purchase, amount }] }
const settle = asyncHandler(async (req, res) => {
  const { supplier, mode, reference, date, allocations } = req.body;
  if (!supplier) throw new ApiError(400, "supplier is required.");
  if (!Array.isArray(allocations) || allocations.length === 0) {
    throw new ApiError(400, "At least one invoice allocation is required.");
  }

  const prepared = [];
  for (const alloc of allocations) {
    const amt = Number(alloc.amount);
    if (!amt || amt <= 0) continue;
    const purchase = await Purchase.findById(alloc.purchase);
    if (!purchase) throw new ApiError(404, `Purchase ${alloc.purchase} not found.`);
    if (String(purchase.supplier) !== String(supplier)) {
      throw new ApiError(400, `Invoice ${purchase.number} does not belong to this supplier.`);
    }
    const balanceDue = Math.max((purchase.grandTotal || 0) - (purchase.amountPaid || 0), 0);
    if (amt > balanceDue) {
      throw new ApiError(
        400,
        `Amount ${amt.toFixed(2)} exceeds the balance ${balanceDue.toFixed(2)} on invoice ${purchase.number}.`
      );
    }
    prepared.push({ purchase, amt });
  }

  if (prepared.length === 0) throw new ApiError(400, "No valid allocations to record.");

  const number = await nextPaymentOutNumber();
  const created = [];
  for (const { purchase, amt } of prepared) {
    const payment = await PurchasePayment.create({
      number,
      purchase: purchase._id,
      supplier: purchase.supplier,
      warehouse: purchase.warehouse,
      amount: amt,
      mode: mode || "cash",
      reference,
      status: "success",
      createdBy: req.auth.user._id,
      ...(date ? { createdAt: new Date(date) } : {}),
    });
    applyToPurchase(purchase, amt);
    await purchase.save();
    created.push(payment);
  }

  const totalRecorded = prepared.reduce((s, p) => s + p.amt, 0);
  res.status(201).json({ success: true, number, count: created.length, totalRecorded, items: created });
});

module.exports = { list, outstanding, settle };
