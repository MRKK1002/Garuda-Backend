const express = require("express");
const ctrl = require("../controllers/productController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");
const { upload } = require("../middleware/upload");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("products.view"), ctrl.list);
router.post("/bulk", requirePermission("products.create"), ctrl.bulkUpsert);
router.post("/upload", requirePermission("products.create"), upload.array("images", 8), ctrl.uploadImages);
router.get("/:id", requirePermission("products.view"), ctrl.getOne);
router.post("/", requirePermission("products.create"), ctrl.create);
router.put("/:id", requirePermission("products.edit"), ctrl.update);
router.delete("/:id", requirePermission("products.delete"), ctrl.remove);

module.exports = router;
