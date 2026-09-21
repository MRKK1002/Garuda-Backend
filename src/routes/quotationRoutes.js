const express = require("express");
const ctrl = require("../controllers/quotationController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();

// Public: shareable PDF link (no auth) so customers can open it directly.
router.get("/:id/pdf", ctrl.pdf);

router.use(authenticate);

router.get("/", requirePermission("quotations.view"), ctrl.list);
router.get("/next-number", requirePermission("quotations.view"), ctrl.nextNumber);
router.get("/:id", requirePermission("quotations.view"), ctrl.getOne);
router.post("/", requirePermission("quotations.create"), ctrl.create);
router.put("/:id", requirePermission("quotations.edit"), ctrl.update);
router.patch("/:id/status", requirePermission("quotations.approve"), ctrl.changeStatus);
router.post("/:id/send", requirePermission("quotations.approve"), ctrl.sendQuotation);
router.post("/:id/convert", requirePermission("orders.create"), ctrl.convertToOrder);
router.delete("/:id", requirePermission("quotations.edit"), ctrl.remove);

module.exports = router;
