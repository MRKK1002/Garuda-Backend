const express = require("express");
const ctrl = require("../controllers/categoryController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("categories.view"), ctrl.list);
router.post("/upload", requirePermission("categories.create"), upload.single("image"), ctrl.uploadImage);
router.get("/:id", requirePermission("categories.view"), ctrl.getOne);
router.post("/", requirePermission("categories.create"), ctrl.create);
router.put("/:id", requirePermission("categories.edit"), ctrl.update);
router.delete("/:id", requirePermission("categories.delete"), ctrl.remove);

module.exports = router;
