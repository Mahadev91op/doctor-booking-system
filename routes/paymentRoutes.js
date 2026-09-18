const express = require("express");

const router = express.Router();

const {
  protect,
  patientOnly,
  doctorOnly,
} = require("../middleware/authMiddleware");

const { createOrder } = require("../controllers/paymentController");
const {
  verifyPayment,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getDoctorSubscriptionStatus,
  razorpayWebhook,
} = require("../controllers/paymentController");

router.post("/create-order", protect, patientOnly, createOrder);
router.post("/verify", protect, patientOnly, verifyPayment);
router.get(
  "/subscription/status",
  protect,
  doctorOnly,
  getDoctorSubscriptionStatus,
);
router.post(
  "/subscription/create-order",
  protect,
  doctorOnly,
  createSubscriptionOrder,
);

router.post(
  "/subscription/verify",
  protect,
  doctorOnly,
  verifySubscriptionPayment,
);

router.post("/webhook", razorpayWebhook);

module.exports = router;
