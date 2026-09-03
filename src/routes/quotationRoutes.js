const express = require("express");
const ctrl = require("../controllers/quotationController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("quotations.view"), ctrl.list);
router.get("/:id", requirePermission("quotations.view"), ctrl.getOne);
router.post("/", requirePermission("quotations.create"), ctrl.create);
router.put("/:id", requirePermission("quotations.edit"), ctrl.update);
router.patch("/:id/status", requirePermission("quotations.approve"), ctrl.changeStatus);
router.post("/:id/convert", requirePermission("orders.create"), ctrl.convertToOrder);
router.delete("/:id", requirePermission("quotations.edit"), ctrl.remove);

module.exports = router;
