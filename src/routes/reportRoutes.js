const express = require("express");
const ctrl = require("../controllers/reportController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);
router.use(requirePermission("reports.view"));

router.get("/sales", ctrl.sales);
router.get("/leads", ctrl.leads);
router.get("/payments", ctrl.payments);
router.get("/inventory", ctrl.inventory);
router.get("/customers", ctrl.customers);

module.exports = router;
