const mongoose = require("mongoose");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

async function runTask3Tests() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/doctor_booking";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for Task 3 verification...\n");

    // 1. Fetch a demo doctor with payoutAccountId
    const doctor = await Doctor.findOne({ payoutAccountId: { $ne: "" } });
    if (!doctor) {
      throw new Error("No doctor with payoutAccountId found!");
    }
    console.log(`✅ Selected Doctor: ${doctor.name}`);
    console.log(`   Specialization: ${doctor.specialization}`);
    console.log(`   Database Payout Account: ${doctor.payoutAccountId}`);
    console.log(`   Official Consultation Fee: ₹${doctor.consultationFee}\n`);

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

    // 3. Simulate appointment creation with tampered amount to test authoritative fee enforcement
    const testAppointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentType: "normal",
      amountPaid: 10, // Intentionally tampered client amount (₹10 instead of doctor fee)
      paymentStatus: "pending",
      status: "pending_payment",
      bookingReference: "BK_TEST_" + Date.now(),
      appointmentDate: new Date(),
    });

    console.log(`--- Test 1: Authoritative Amount & Doctor Payout Lookup ---`);
    console.log(`Tampered initial appointment amount: ₹${testAppointment.amountPaid}`);

    const secret = process.env.JWT_SECRET || "sehatraj_jwt_secret_key_2026_super_secure";
    const patientToken = jwt.sign({ id: patient._id }, secret, { expiresIn: "1h" });

    const orderRes = await fetch("http://localhost:5000/api/payment/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        appointmentId: testAppointment._id.toString(),
        // Even if client attempts to inject a fake payout account:
        payoutAccountId: "acc_malicious_hacker_999",
      }),
    });

    const orderData = await orderRes.json();
    console.log("Create Order Response:", orderData.success ? "SUCCESS" : "FAILED", orderData.payoutRouting);

    if (!orderData.success) {
      throw new Error(`Order creation failed: ${orderData.message}`);
    }

    const updatedAppt = await Appointment.findById(testAppointment._id);
    console.log(`Authoritative Doctor Fee enforced: ₹${updatedAppt.amountPaid} (Doctor fee was ₹${doctor.consultationFee})`);
    console.log(`Doctor Payout Account assigned: ${updatedAppt.payoutAccountId}`);
    console.log(`Routing Status: ${updatedAppt.routingStatus}`);

    if (updatedAppt.amountPaid !== doctor.consultationFee) {
      throw new Error("FAIL: Tampered fee was not corrected to authoritative doctor fee!");
    }
    if (updatedAppt.payoutAccountId !== doctor.payoutAccountId) {
      throw new Error("FAIL: Payout account was not fetched authoritatively from doctor record!");
    }
    console.log("✅ PASS: Server authoritatively verified amount & doctor payout account!\n");

    // 4. Test Payment Verification & Idempotency
    console.log(`--- Test 2: Secure Payment Verification & Idempotency ---`);
    const mockPaymentId = "pay_test_" + Date.now();
    const orderId = updatedAppt.orderId;

    const verifyRes1 = await fetch("http://localhost:5000/api/payment/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: "mock_signature_test",
      }),
    });

    const verifyData1 = await verifyRes1.json();
    console.log("First Verification Response:", verifyData1.message);

    const apptAfterVerify = await Appointment.findById(testAppointment._id);
    if (apptAfterVerify.paymentStatus !== "paid" || apptAfterVerify.status !== "confirmed") {
      throw new Error(`FAIL: Appointment status not confirmed: ${apptAfterVerify.status}`);
    }
    console.log("✅ PASS: Payment verified, appointment confirmed.");

    // Duplicate call (Idempotency check)
    const verifyRes2 = await fetch("http://localhost:5000/api/payment/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: "mock_signature_test",
      }),
    });

    const verifyData2 = await verifyRes2.json();
    console.log("Duplicate Verification Response:", verifyData2.message);
    if (!verifyData2.success) {
      throw new Error("FAIL: Duplicate payment verification failed instead of returning idempotent 200!");
    }
    console.log("✅ PASS: Idempotency verified. Duplicate call handled cleanly without error!\n");

    // 5. Test Webhook listener for transfer.processed
    console.log(`--- Test 3: Razorpay Webhook Route Transfer Event ---`);
    const webhookPayload = {
      event: "transfer.processed",
      payload: {
        transfer: {
          entity: {
            id: "trf_test_route_99999",
            recipient: doctor.payoutAccountId,
            amount: updatedAppt.amountPaid * 100,
            currency: "INR",
            status: "processed",
            notes: {
              appointmentId: testAppointment._id.toString(),
            },
          },
        },
      },
    };

    const webhookRes = await fetch("http://localhost:5000/api/payment/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookData = await webhookRes.json();
    console.log("Webhook Response:", webhookData);

    const finalAppt = await Appointment.findById(testAppointment._id);
    console.log(`Final Appointment Transfer ID: ${finalAppt.transferId}`);
    console.log(`Final Appointment Routing Status: ${finalAppt.routingStatus}`);

    if (finalAppt.routingStatus !== "routed" || finalAppt.transferId !== "trf_test_route_99999") {
      throw new Error("FAIL: Webhook did not update routingStatus to 'routed' or record transferId!");
    }
    console.log("✅ PASS: Webhook processed transfer event and updated booking ledger!\n");

    // Clean up test appointment
    await Appointment.findByIdAndDelete(testAppointment._id);
    console.log("🎉 All Task 3 tests passed successfully!");

    process.exit(0);
  } catch (err) {
    console.error("❌ Task 3 Test Failed:", err);
    process.exit(1);
  }
}

runTask3Tests();
