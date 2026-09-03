const express = require("express");
const ctrl = require("../controllers/returnController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// Returns are gated by order permissions (create=create return, edit=approve/refund).
router.get("/", requirePermission("orders.view"), ctrl.list);
router.post("/", requirePermission("orders.create"), ctrl.create);
router.patch("/:id/status", requirePermission("orders.edit"), ctrl.changeStatus);

module.exports = router;
