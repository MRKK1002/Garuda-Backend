const express = require("express");
const ctrl = require("../controllers/brandController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("brands.view"), ctrl.list);
router.post("/upload", requirePermission("brands.create"), upload.single("image"), ctrl.uploadImage);
router.get("/:id", requirePermission("brands.view"), ctrl.getOne);
router.post("/", requirePermission("brands.create"), ctrl.create);
router.put("/:id", requirePermission("brands.edit"), ctrl.update);
router.delete("/:id", requirePermission("brands.delete"), ctrl.remove);

module.exports = router;
