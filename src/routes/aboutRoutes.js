const express = require("express");
const ctrl = require("../controllers/aboutController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("about.view"), ctrl.get);
router.put("/", requirePermission("about.edit"), ctrl.update);
router.post("/upload", requirePermission("about.edit"), upload.single("image"), ctrl.uploadImage);

module.exports = router;
