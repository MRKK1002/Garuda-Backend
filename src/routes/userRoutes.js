const express = require("express");
const ctrl = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();
router.use(authenticate);

router.get("/", requirePermission("users.view"), ctrl.list);
router.get("/:id", requirePermission("users.view"), ctrl.getOne);
router.post("/", requirePermission("users.create"), ctrl.create);
router.put("/:id", requirePermission("users.edit"), ctrl.update);
router.delete("/:id", requirePermission("users.delete"), ctrl.remove);

module.exports = router;
