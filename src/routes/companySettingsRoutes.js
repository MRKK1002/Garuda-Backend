const express = require("express");
const ctrl = require("../controllers/companySettingsController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("settings.view"), ctrl.get);
router.put("/", requirePermission("settings.edit"), ctrl.update);
router.post("/upload", requirePermission("settings.edit"), upload.single("image"), ctrl.uploadImage);

module.exports = router;
