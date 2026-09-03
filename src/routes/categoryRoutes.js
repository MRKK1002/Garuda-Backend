const express = require("express");
const ctrl = require("../controllers/categoryController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("categories.view"), ctrl.list);
router.get("/:id", requirePermission("categories.view"), ctrl.getOne);
router.post("/", requirePermission("categories.create"), ctrl.create);
router.put("/:id", requirePermission("categories.edit"), ctrl.update);
router.delete("/:id", requirePermission("categories.delete"), ctrl.remove);

module.exports = router;
