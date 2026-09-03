const express = require("express");
const ctrl = require("../controllers/deliveryController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("deliveries.view"), ctrl.list);
router.post("/", requirePermission("deliveries.create"), ctrl.create);
router.patch("/:id", requirePermission("deliveries.edit"), ctrl.update);

module.exports = router;
