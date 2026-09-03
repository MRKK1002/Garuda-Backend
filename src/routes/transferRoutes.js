const express = require("express");
const ctrl = require("../controllers/transferController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// Transfers are gated by the inventory.transfer permission.
router.get("/", requirePermission("inventory.transfer"), ctrl.list);
router.post("/", requirePermission("inventory.transfer"), ctrl.create);
router.patch("/:id/status", requirePermission("inventory.transfer"), ctrl.changeStatus);

module.exports = router;
