const express = require("express");
const ctrl = require("../controllers/dashboardController");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// Any authenticated user can see the dashboard (content is showroom-scoped).
router.get("/stats", ctrl.stats);

module.exports = router;
