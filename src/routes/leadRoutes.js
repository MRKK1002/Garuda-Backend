const express = require("express");
const ctrl = require("../controllers/leadController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("leads.view"), ctrl.list);
router.get("/:id", requirePermission("leads.view"), ctrl.getOne);
router.post("/", requirePermission("leads.create"), ctrl.create);
router.put("/:id", requirePermission("leads.edit"), ctrl.update);
router.patch("/:id/stage", requirePermission("leads.edit"), ctrl.changeStage);
router.post("/:id/follow-up", requirePermission("leads.edit"), ctrl.addFollowUp);
// Converting a lead creates a quotation, so require quotation-create permission.
router.post("/:id/convert", requirePermission("quotations.create"), ctrl.convert);
router.delete("/:id", requirePermission("leads.delete"), ctrl.remove);

module.exports = router;
