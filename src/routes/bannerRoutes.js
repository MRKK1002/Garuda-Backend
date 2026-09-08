const express = require("express");
const ctrl = require("../controllers/bannerController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("banners.view"), ctrl.list);
router.post("/upload", requirePermission("banners.create"), upload.single("image"), ctrl.uploadImage);
router.get("/:id", requirePermission("banners.view"), ctrl.getOne);
router.post("/", requirePermission("banners.create"), ctrl.create);
router.put("/:id", requirePermission("banners.edit"), ctrl.update);
router.delete("/:id", requirePermission("banners.delete"), ctrl.remove);

module.exports = router;
