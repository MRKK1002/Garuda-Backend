const express = require("express");
const ctrl = require("../controllers/paymentOutController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// Gated on inventory permissions for now (like purchases); dedicated purchases.*
// permissions can be added later.
router.get("/", requirePermission("inventory.view"), ctrl.list);
router.get("/outstanding", requirePermission("inventory.view"), ctrl.outstanding);
router.post("/settle", requirePermission("inventory.transfer"), ctrl.settle);

module.exports = router;
