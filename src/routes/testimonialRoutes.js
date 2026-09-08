const express = require("express");
const ctrl = require("../controllers/testimonialController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("testimonials.view"), ctrl.list);
router.post("/upload", requirePermission("testimonials.create"), upload.single("image"), ctrl.uploadImage);
router.get("/:id", requirePermission("testimonials.view"), ctrl.getOne);
router.post("/", requirePermission("testimonials.create"), ctrl.create);
router.put("/:id", requirePermission("testimonials.edit"), ctrl.update);
router.delete("/:id", requirePermission("testimonials.delete"), ctrl.remove);

module.exports = router;
