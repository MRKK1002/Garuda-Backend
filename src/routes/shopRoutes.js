// Public storefront routes. NO staff authentication - these serve the e-commerce
// website. Customer-token routes (auth) enforce their own guard in the controller.
const express = require("express");
const ctrl = require("../controllers/shopController");
const auth = require("../controllers/shopAuthController");
const reviews = require("../controllers/reviewController");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/products", ctrl.listProducts);
router.get("/products/:id", ctrl.getProduct);

// Reviews (read public; write requires a logged-in verified-purchase customer).
router.get("/products/:id/reviews", reviews.listReviews);
router.post("/products/:id/reviews", reviews.createReview);
router.post("/reviews/upload", upload.single("image"), reviews.uploadReviewImage);
router.get("/categories", ctrl.listCategories);
router.get("/brands", ctrl.listBrands);
router.get("/showrooms", ctrl.listShowrooms);
router.get("/banners", ctrl.listBanners);
router.get("/testimonials", ctrl.listTestimonials);
router.post("/enquiry", ctrl.submitEnquiry);

// Customer phone-OTP auth.
router.post("/auth/request-otp", auth.requestOtp);
router.post("/auth/verify-otp", auth.verifyOtp);
router.post("/auth/complete-profile", auth.completeProfile);
router.get("/auth/me", auth.me);
router.put("/auth/profile", auth.updateProfile);
router.get("/auth/orders", auth.myOrders);
router.post("/auth/checkout", auth.checkout);

module.exports = router;
