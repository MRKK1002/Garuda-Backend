const express = require("express");
const ctrl = require("../controllers/inventoryController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("inventory.view"), ctrl.list);
router.get("/ledger", requirePermission("inventory.view"), ctrl.ledger);
router.post("/inward", requirePermission("inventory.inward"), ctrl.inward);
router.post("/bulk-inward", requirePermission("inventory.inward"), ctrl.bulkInward);
router.post("/adjust", requirePermission("inventory.adjust"), ctrl.adjust);
router.post("/damage", requirePermission("inventory.adjust"), ctrl.damage);

module.exports = router;
