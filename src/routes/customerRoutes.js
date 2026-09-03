const express = require("express");
const ctrl = require("../controllers/customerController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("customers.view"), ctrl.list);
router.post("/bulk", requirePermission("customers.create"), ctrl.bulkUpsert);
router.get("/:id", requirePermission("customers.view"), ctrl.getOne);
router.post("/", requirePermission("customers.create"), ctrl.create);
router.put("/:id", requirePermission("customers.edit"), ctrl.update);
router.delete("/:id", requirePermission("customers.delete"), ctrl.remove);

module.exports = router;
