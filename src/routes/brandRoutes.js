const express = require("express");
const ctrl = require("../controllers/brandController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("brands.view"), ctrl.list);
router.get("/:id", requirePermission("brands.view"), ctrl.getOne);
router.post("/", requirePermission("brands.create"), ctrl.create);
router.put("/:id", requirePermission("brands.edit"), ctrl.update);
router.delete("/:id", requirePermission("brands.delete"), ctrl.remove);

module.exports = router;
