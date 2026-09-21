const express = require("express");
const ctrl = require("../controllers/debitNoteController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("inventory.view"), ctrl.list);
router.get("/next-number", requirePermission("inventory.view"), ctrl.nextNumber);
router.get("/:id", requirePermission("inventory.view"), ctrl.getOne);
router.post("/", requirePermission("inventory.transfer"), ctrl.create);

module.exports = router;
