const express = require("express");
const ctrl = require("../controllers/orderController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("orders.view"), ctrl.list);
router.get("/:id", requirePermission("orders.view"), ctrl.getOne);
router.post("/", requirePermission("orders.create"), ctrl.create);
// cancel needs orders.cancel; other transitions need orders.edit. The controller
// enforces the state machine; here we allow edit or cancel to reach it.
router.patch("/:id/status", requirePermission("orders.edit"), ctrl.changeStatus);

module.exports = router;
