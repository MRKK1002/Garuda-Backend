const express = require("express");
const ctrl = require("../controllers/showroomController");
const targetCtrl = require("../controllers/targetController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

// Showroom targets + performance.
router.get("/:id/targets", requirePermission("showrooms.view"), targetCtrl.listForShowroom);
router.post("/:id/targets", requirePermission("showrooms.edit"), targetCtrl.setTarget);

router.get("/", requirePermission("showrooms.view"), ctrl.list);
router.get("/:id", requirePermission("showrooms.view"), ctrl.getOne);
router.post("/", requirePermission("showrooms.create"), ctrl.create);
router.put("/:id", requirePermission("showrooms.edit"), ctrl.update);
router.delete("/:id", requirePermission("showrooms.delete"), ctrl.remove);

module.exports = router;
