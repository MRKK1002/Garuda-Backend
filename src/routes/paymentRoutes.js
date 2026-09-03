const express = require("express");
const ctrl = require("../controllers/paymentController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("payments.view"), ctrl.list);
router.post("/", requirePermission("payments.create"), ctrl.create);

module.exports = router;
