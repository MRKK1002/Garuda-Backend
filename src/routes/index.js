// Mounts all v1 routes under /api/v1.
const express = require("express");
const authRoutes = require("./authRoutes");
const showroomRoutes = require("./showroomRoutes");
const roleRoutes = require("./roleRoutes");
const userRoutes = require("./userRoutes");
const categoryRoutes = require("./categoryRoutes");
const brandRoutes = require("./brandRoutes");
const productRoutes = require("./productRoutes");
const inventoryRoutes = require("./inventoryRoutes");
const transferRoutes = require("./transferRoutes");
const customerRoutes = require("./customerRoutes");
const leadRoutes = require("./leadRoutes");
const quotationRoutes = require("./quotationRoutes");
const orderRoutes = require("./orderRoutes");
const paymentRoutes = require("./paymentRoutes");
const deliveryRoutes = require("./deliveryRoutes");
const returnRoutes = require("./returnRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const reportRoutes = require("./reportRoutes");

const router = express.Router();

router.get("/health", (req, res) => res.json({ success: true, status: "ok" }));

router.use("/auth", authRoutes);
router.use("/showrooms", showroomRoutes);
router.use("/roles", roleRoutes);
router.use("/users", userRoutes);
router.use("/categories", categoryRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/transfers", transferRoutes);
router.use("/customers", customerRoutes);
router.use("/leads", leadRoutes);
router.use("/quotations", quotationRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/deliveries", deliveryRoutes);
router.use("/returns", returnRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);

module.exports = router;
