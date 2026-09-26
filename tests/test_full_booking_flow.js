const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

async function testFullBookingFlow() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/doctor_booking";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for End-to-End Booking Test...\n");

    // 1. Get a patient and a doctor
    const doctor = await Doctor.findOne({ name: "Dr. Rajesh Sharma" });
    const patient = await User.findOne({ role: "patient" });

    const secret = process.env.JWT_SECRET || "sehatraj_jwt_secret_key_2026_super_secure";
    const patientToken = jwt.sign({ id: patient._id }, secret, { expiresIn: "1h" });

    console.log("==========================================");
    console.log("1. TESTING NORMAL APPOINTMENT BOOKING FLOW");
    console.log("==========================================");

    // Step A: Book Normal Appointment on Doctor's working day
    let normalDate = new Date();
    while (!doctor.workingDays.includes(normalDate.toLocaleDateString("en-US", { weekday: "long" }))) {
      normalDate.setDate(normalDate.getDate() + 1);
    }
    const normalDateStr = normalDate.toISOString().split("T")[0];

    const normalBookRes = await fetch("http://localhost:5000/api/appointments/normal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ doctorId: doctor._id.toString(), date: normalDateStr }),
    });

    const normalBookData = await normalBookRes.json();
    console.log("Normal Booking API Response:", normalBookData.success ? "SUCCESS" : "FAILED");
    if (!normalBookData.success) throw new Error("Normal booking failed: " + normalBookData.message);

    const normalApptId = normalBookData.appointment._id;
    console.log("Created Appointment ID:", normalApptId, "| Token:", normalBookData.tokenNumber);

    // Step B: Create Payment Order
    const orderRes = await fetch("http://localhost:5000/api/payment/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ appointmentId: normalApptId }),
    });

    const orderData = await orderRes.json();
    console.log("Razorpay Order Created:", orderData.order.id, "| Amount (paise):", orderData.order.amount);
    if (!orderData.success) throw new Error("Order creation failed: " + orderData.message);

    // Step C: Verify Payment
    const mockPaymentId = "pay_test_normal_" + Date.now();
    const verifyRes = await fetch("http://localhost:5000/api/payment/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderData.order.id,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: "mock_signature_test",
      }),
    });

    const verifyData = await verifyRes.json();
    console.log("Payment Verification:", verifyData.message);
    if (!verifyData.success) throw new Error("Payment verification failed: " + verifyData.message);

    const checkNormalAppt = await Appointment.findById(normalApptId);
    console.log("Normal Appointment Status:", checkNormalAppt.status, "| Payment Status:", checkNormalAppt.paymentStatus);
    if (checkNormalAppt.paymentStatus !== "paid") throw new Error("Payment status not paid!");
    console.log("✅ NORMAL APPOINTMENT BOOKING PASSED 100%!\n");

    console.log("==========================================");
    console.log("2. TESTING PREMIUM APPOINTMENT & SLOTS FLOW");
    console.log("==========================================");

    // Step A: Fetch Premium Slots (ensure working day, skipping Sunday)
    let testDate = new Date();
    testDate.setDate(testDate.getDate() + 1);
    if (testDate.getDay() === 0) {
      testDate.setDate(testDate.getDate() + 1); // Skip Sunday to Monday
    }
    const dateStr = testDate.toISOString().split("T")[0];

    const slotsRes = await fetch(`http://localhost:5000/api/doctors/${doctor._id}/premium-slots?date=${dateStr}`);
    const slotsData = await slotsRes.json();
    console.log(`Slots API for ${dateStr}: Found ${slotsData.availableSlots?.length} available slots`);
    if (!slotsData.success || !slotsData.availableSlots || slotsData.availableSlots.length === 0) {
      throw new Error("No slots returned for premium date: " + dateStr);
    }
    const chosenSlot = slotsData.availableSlots[0];
    console.log("Selected Slot:", chosenSlot);

    // Step B: Book Premium Appointment
    const premiumBookRes = await fetch("http://localhost:5000/api/appointments/premium", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: doctor._id.toString(),
        slotDate: dateStr,
        slotTime: chosenSlot,
      }),
    });

    const premiumBookData = await premiumBookRes.json();
    console.log("Premium Booking API Response:", premiumBookData.success ? "SUCCESS" : "FAILED");
    if (!premiumBookData.success) throw new Error("Premium booking failed: " + premiumBookData.message);

    const premiumApptId = premiumBookData.appointment._id;
    console.log("Created Premium Appointment ID:", premiumApptId);

    // Step C: Create Payment Order for Premium
    const premOrderRes = await fetch("http://localhost:5000/api/payment/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ appointmentId: premiumApptId }),
    });

    const premOrderData = await premOrderRes.json();
    console.log("Premium Razorpay Order Created:", premOrderData.order.id, "| Amount (paise):", premOrderData.order.amount);
    if (!premOrderData.success) throw new Error("Premium order creation failed: " + premOrderData.message);

    // Step D: Verify Payment for Premium
    const mockPremPaymentId = "pay_test_prem_" + Date.now();
    const premVerifyRes = await fetch("http://localhost:5000/api/payment/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: premOrderData.order.id,
        razorpay_payment_id: mockPremPaymentId,
        razorpay_signature: "mock_signature_test",
      }),
    });

    const premVerifyData = await premVerifyRes.json();
    console.log("Premium Payment Verification:", premVerifyData.message);
    if (!premVerifyData.success) throw new Error("Premium payment verification failed: " + premVerifyData.message);

    const checkPremAppt = await Appointment.findById(premiumApptId);
    console.log("Premium Appointment Status:", checkPremAppt.status, "| Payment Status:", checkPremAppt.paymentStatus);
    if (checkPremAppt.paymentStatus !== "paid") throw new Error("Premium payment status not paid!");
    console.log("✅ PREMIUM APPOINTMENT BOOKING PASSED 100%!\n");

    // Clean up test appointments
    await Appointment.findByIdAndDelete(normalApptId);
    await Appointment.findByIdAndDelete(premiumApptId);

    console.log("🎉 ALL END-TO-END BOOKING & PAYMENT TESTS PASSED PERFECTLY!");
    process.exit(0);
  } catch (err) {
    console.error("❌ End-to-end Test Failed:", err);
    process.exit(1);
  }
}

testFullBookingFlow();
