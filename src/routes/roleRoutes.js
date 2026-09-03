const express = require("express");
const ctrl = require("../controllers/roleController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// Catalog endpoint - any user who can view roles can read the permission catalog.
router.get("/permission-catalog", requirePermission("roles.view"), ctrl.permissionCatalog);

router.get("/", requirePermission("roles.view"), ctrl.list);
router.get("/:id", requirePermission("roles.view"), ctrl.getOne);
router.post("/", requirePermission("roles.create"), ctrl.create);
router.put("/:id", requirePermission("roles.edit"), ctrl.update);
router.delete("/:id", requirePermission("roles.delete"), ctrl.remove);

module.exports = router;
