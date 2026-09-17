const express = require("express");
const ctrl = require("../controllers/couponController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/",     requirePermission("coupons.view"),   ctrl.list);
router.get("/:id",  requirePermission("coupons.view"),   ctrl.getOne);
router.post("/",    requirePermission("coupons.create"), ctrl.create);
router.put("/:id",  requirePermission("coupons.edit"),   ctrl.update);
router.delete("/:id", requirePermission("coupons.delete"), ctrl.remove);

module.exports = router;
