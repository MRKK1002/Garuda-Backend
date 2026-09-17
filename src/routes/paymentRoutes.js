const express = require("express");
const ctrl = require("../controllers/paymentController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("payments.view"), ctrl.list);
router.get("/outstanding", requirePermission("payments.view"), ctrl.outstanding);
router.post("/", requirePermission("payments.create"), ctrl.create);
router.post("/settle", requirePermission("payments.create"), ctrl.settle);

module.exports = router;
