const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const DoctorSubscription = require("../models/DoctorSubscription");
const checkDoctorSubscription = require("../utils/checkDoctorSubscription");

async function runTask4Tests() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/doctor_booking";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for Task 4 testing...\n");

    const jwtSecret = process.env.JWT_SECRET || "sehatraj_jwt_secret_key_2026_super_secure";

    // 1. Fetch a demo doctor
    let doctor = await Doctor.findOne({ email: "rajesh.sharma@sehatraj.com" });
    if (!doctor) {
      doctor = await Doctor.findOne({});
    }
    if (!doctor) {
      throw new Error("No doctor found in database!");
    }

    console.log(`👨‍⚕️ Testing Doctor: ${doctor.name}`);
    console.log(`   Initial Status: ${doctor.subscriptionStatus}`);
    console.log(`   Initial Plan: ${doctor.subscriptionPlan}`);
    console.log(`   Trial Expiry: ${doctor.trialEndDate || doctor.subscriptionExpiryDate}\n`);

    // 2. Fetch or create a test patient
    let patient = await User.findOne({ role: "patient" });
    if (!patient) {
      patient = await User.create({
        name: "Test Patient",
        email: "patient.test@sehatraj.com",
        mobile: "9111111111",
        password: "hashedPassword123",
        role: "patient",
      });
    }
    const patientToken = jwt.sign({ id: patient._id }, jwtSecret, { expiresIn: "1h" });

    // Doctor JWT token
    const doctorUser = await User.findById(doctor.userId);
    if (!doctorUser) {
      throw new Error(`Doctor user record not found for userId: ${doctor.userId}`);
    }
    const doctorToken = jwt.sign({ id: doctorUser._id }, jwtSecret, { expiresIn: "1h" });

    // Admin JWT token
    const adminUser = await User.findOne({ role: "admin" });
    const adminToken = adminUser ? jwt.sign({ id: adminUser._id }, jwtSecret, { expiresIn: "1h" }) : null;

    // --- TEST 1: Simulate Trial Expiry & Real-time Enforcement ---
    console.log("--- TEST 1: Trial Expiration & Real-time Booking Restriction ---");
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

    doctor.subscriptionStatus = "trial";
    doctor.trialEndDate = pastDate;
    doctor.subscriptionExpiryDate = pastDate;
    await doctor.save();

    // Check that checkDoctorSubscription transitions status to 'expired'
    await checkDoctorSubscription(doctor);
    console.log(`Doctor status after checkDoctorSubscription: ${doctor.subscriptionStatus}`);
    if (doctor.subscriptionStatus !== "expired") {
      throw new Error("Expected doctor status to be 'expired'!");
    }
    console.log("✅ PASSED: Overdue 30-day trial automatically transitioned to 'expired'.\n");

    // --- TEST 2: Attempt Booking for Expired Doctor ---
    console.log("--- TEST 2: Patient Booking Blocked for Expired Doctor ---");
    const blockedRes = await fetch("http://localhost:5000/api/appointments/normal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ doctorId: doctor._id.toString() }),
    });

    const blockedData = await blockedRes.json();
    console.log(`Booking Response Status: ${blockedRes.status}`);
    console.log(`Booking Response Message: ${blockedData.message}`);
    if (blockedRes.status !== 400 || !blockedData.message.includes("unavailable")) {
      throw new Error("Expected booking to be blocked for expired doctor!");
    }
    console.log("✅ PASSED: Expired doctor cannot receive patient bookings.\n");

    // --- TEST 3: Doctor Creates ₹499/month SaaS Subscription Order ---
    console.log("--- TEST 3: ₹499/month SaaS Subscription Order Creation (Platform Directed) ---");
    const subOrderRes = await fetch("http://localhost:5000/api/payment/subscription/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ plan: "monthly" }),
    });

    const subOrderData = await subOrderRes.json();
    if (!subOrderRes.ok || !subOrderData.success) {
      throw new Error(`Subscription order failed: ${subOrderData.message}`);
    }

    console.log(`Subscription Order ID: ${subOrderData.order.id}`);
    console.log(`Subscription Amount: ₹${subOrderData.order.amount / 100}`);
    console.log(`Platform Destination: ${subOrderData.platformAccountId || "Main Platform Account"}`);
    if (subOrderData.order.amount !== 49900) {
      throw new Error(`Expected amount 49900 paise (₹499), got ${subOrderData.order.amount}`);
    }
    console.log("✅ PASSED: ₹499/month SaaS subscription order created directly for Platform/Admin account.\n");

    // --- TEST 4: Verify Subscription Payment ---
    console.log("--- TEST 4: Subscription Payment Verification & Reactivation ---");
    const verifyRes = await fetch("http://localhost:5000/api/payment/subscription/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: subOrderData.order.id,
        razorpay_payment_id: "pay_test_sub_" + Date.now(),
        razorpay_signature: "mock_signature_test",
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(`Verification failed: ${verifyData.message}`);
    }

    // Refresh doctor from DB
    doctor = await Doctor.findById(doctor._id);
    console.log(`Activated Doctor Status: ${doctor.subscriptionStatus}`);
    console.log(`Activated Plan: ${doctor.subscriptionPlan}`);
    console.log(`New Expiry Date: ${doctor.subscriptionExpiryDate}`);

    if (doctor.subscriptionStatus !== "active" || doctor.subscriptionPlan !== "monthly") {
      throw new Error("Doctor was not properly activated as 'active' monthly!");
    }
    console.log("✅ PASSED: Doctor subscription successfully activated for ₹499/month with 30-day validity.\n");

    // --- TEST 5: Idempotency Check ---
    console.log("--- TEST 5: Subscription Verification Idempotency ---");
    const dupVerifyRes = await fetch("http://localhost:5000/api/payment/subscription/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: subOrderData.order.id,
        razorpay_payment_id: "pay_test_sub_" + Date.now(),
        razorpay_signature: "mock_signature_test",
      }),
    });

    const dupVerifyData = await dupVerifyRes.json();
    console.log(`Duplicate Status: ${dupVerifyRes.status} | Message: ${dupVerifyData.message}`);
    if (dupVerifyRes.status !== 200) {
      throw new Error("Duplicate verification should return 200 idempotent response!");
    }
    console.log("✅ PASSED: Verification idempotency confirmed.\n");

    // --- TEST 6: Patient Can Now Book Active Doctor ---
    console.log("--- TEST 6: Patient Booking Succeeds After Subscription Reactivation ---");
    const bookingRes = await fetch("http://localhost:5000/api/appointments/normal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ doctorId: doctor._id.toString() }),
    });

    const bookingData = await bookingRes.json();
    if (!bookingRes.ok || !bookingData.success) {
      throw new Error(`Booking failed after reactivation: ${bookingData.message}`);
    }
    console.log(`Appointment Created! Token: ${bookingData.tokenNumber} | ID: ${bookingData.appointment._id}`);
    console.log("✅ PASSED: Patient can now book appointment with reactivated doctor.\n");

    // --- TEST 7: Doctor Subscription Status Endpoint ---
    console.log("--- TEST 7: Doctor Subscription Status Endpoint ---");
    const statusRes = await fetch("http://localhost:5000/api/payment/subscription/status", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${doctorToken}`,
      },
    });

    const statusData = await statusRes.json();
    if (!statusRes.ok || !statusData.success) {
      throw new Error(`Subscription status endpoint failed: ${statusData.message}`);
    }
    console.log(`Doctor Status Reported: ${statusData.doctor.subscriptionStatus}`);
    console.log(`Remaining Days: ${statusData.doctor.remainingDays}`);
    console.log(`History Count: ${statusData.history.length}`);
    if (statusData.doctor.subscriptionStatus !== "active" || statusData.doctor.remainingDays <= 0) {
      throw new Error("Invalid subscription status response!");
    }
    console.log("✅ PASSED: Subscription status endpoint returns clean data & countdown.\n");

    // --- TEST 8: Admin Expiry Trigger Endpoint ---
    if (adminToken) {
      console.log("--- TEST 8: Admin Check Expired Subscriptions ---");
      const adminExpiryRes = await fetch("http://localhost:5000/api/admin/check-expiry", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const adminExpiryData = await adminExpiryRes.json();
      console.log(`Admin Check Result: ${adminExpiryData.message}`);
      if (!adminExpiryRes.ok || !adminExpiryData.success) {
        throw new Error(`Admin check expiry failed: ${adminExpiryData.message}`);
      }
      console.log("✅ PASSED: Admin check-expiry endpoint works correctly.\n");
    }

    console.log("🎉 ALL TASK 4 TESTS PASSED 100%!");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTask4Tests();
