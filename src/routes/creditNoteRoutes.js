const express = require("express");
const ctrl = require("../controllers/creditNoteController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("orders.view"), ctrl.list);
router.get("/next-number", requirePermission("orders.view"), ctrl.nextNumber);
router.get("/:id", requirePermission("orders.view"), ctrl.getOne);
router.post("/", requirePermission("orders.create"), ctrl.create);

module.exports = router;
