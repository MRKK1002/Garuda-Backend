const express = require("express");
const ctrl = require("../controllers/purchaseController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// NOTE: dedicated purchases.* permissions will be added later; for now purchases are
// gated on inventory permissions since they affect warehouse stock.
router.get("/", requirePermission("inventory.view"), ctrl.list);
router.get("/stats", requirePermission("inventory.view"), ctrl.stats);
router.get("/:id", requirePermission("inventory.view"), ctrl.getOne);
router.post("/", requirePermission("inventory.transfer"), ctrl.create);

module.exports = router;
