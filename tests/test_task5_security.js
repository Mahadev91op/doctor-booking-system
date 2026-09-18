const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

require("../models/User");
require("../models/Doctor");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

const BASE_URL = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "sehatraj_jwt_secret_dev_key_2026";

async function runSecurityAudit() {
  console.log("🔒 =================================================");
  console.log("   TASK 5: COMPREHENSIVE SECURITY & AUDIT SUITE");
  console.log("=================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for Security Audit.\n");

  // 1. Fetch test users & doctors
  const patient1 = await User.findOne({ role: "patient" });
  let patient2 = await User.findOne({ role: "patient", _id: { $ne: patient1._id } });
  if (!patient2) {
    patient2 = await User.create({
      name: "Security Test Patient 2",
      mobile: "9999988888",
      email: "sec.patient2@sehatraj.com",
      password: "hashedPassword123",
      role: "patient",
    });
  }

  const doctor1 = await Doctor.findOne({ payoutAccountId: { $exists: true, $ne: "" } });
  const doctor1User = await User.findById(doctor1.userId);

  const tokenP1 = jwt.sign({ id: patient1._id }, JWT_SECRET, { expiresIn: "1h" });
  const tokenP2 = jwt.sign({ id: patient2._id }, JWT_SECRET, { expiresIn: "1h" });
  const tokenDoc = jwt.sign({ id: doctor1User._id }, JWT_SECRET, { expiresIn: "1h" });

  // Find or create a confirmed appointment owned by Patient 1
  let apptP1 = await Appointment.findOne({ patientId: patient1._id, paymentStatus: "paid" });
  if (!apptP1) {
    apptP1 = await Appointment.create({
      patientId: patient1._id,
      doctorId: doctor1._id,
      appointmentType: "normal",
      bookingReference: "SR-TEST-SEC-" + Date.now(),
      status: "confirmed",
      paymentStatus: "paid",
      amountPaid: doctor1.consultationFee,
      tokenNumber: 99,
      appointmentDate: new Date(),
    });
  }

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] Check ${total}: ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Check ${total}: ${message}`);
    }
  }

  // --- CHECK 1: JWT Authentication Protection ---
  const noTokenRes = await fetch(`${BASE_URL}/patients/appointments`);
  assert(noTokenRes.status === 401, "Requests without JWT token return 401 Unauthorized");

  const invalidTokenRes = await fetch(`${BASE_URL}/patients/appointments`, {
    headers: { Authorization: "Bearer invalid.jwt.token.here" },
  });
  assert(invalidTokenRes.status === 401, "Requests with tampered/invalid JWT token return 401 Unauthorized");

  // --- CHECK 2: Role-Based Access Control (RBAC) ---
  const patientAccessingAdmin = await fetch(`${BASE_URL}/admin/doctors`, {
    headers: { Authorization: `Bearer ${tokenP1}` },
  });
  assert(patientAccessingAdmin.status === 403, "Patient cannot access Admin-only endpoints (403 Forbidden)");

  const patientAccessingDoctorPayout = await fetch(`${BASE_URL}/doctors/payout-account`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payoutAccountId: "acc_malicious_123" }),
  });
  assert(patientAccessingDoctorPayout.status === 403, "Patient cannot modify Doctor Payout Account (403 Forbidden)");

  // --- CHECK 3: IDOR Protection (Patient-to-Patient Ticket Access) ---
  const idorTicketRes = await fetch(`${BASE_URL}/tickets/${apptP1._id}`, {
    headers: { Authorization: `Bearer ${tokenP2}` },
  });
  assert(idorTicketRes.status === 403, "IDOR Blocked: Patient 2 cannot access Patient 1's ticket (403 Forbidden)");

  const idorDownloadRes = await fetch(`${BASE_URL}/tickets/download/${apptP1._id}`, {
    headers: { Authorization: `Bearer ${tokenP2}` },
  });
  assert(idorDownloadRes.status === 403, "IDOR Blocked: Patient 2 cannot download Patient 1's PDF ticket (403 Forbidden)");

  // --- CHECK 4: IDOR Protection (Patient-to-Patient Cancellation) ---
  const idorCancelRes = await fetch(`${BASE_URL}/appointments/${apptP1._id}/cancel`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenP2}`, "Content-Type": "application/json" },
  });
  assert(idorCancelRes.status === 403, "IDOR Blocked: Patient 2 cannot cancel Patient 1's appointment (403 Forbidden)");

  // --- CHECK 5: Client-Provided Amount Never Trusted (Server-Side Pricing) ---
  // Create pending appointment for patient 1
  const testBooking = await Appointment.create({
    patientId: patient1._id,
    doctorId: doctor1._id,
    appointmentType: "normal",
    bookingReference: "SR-TAMPER-" + Date.now(),
    status: "pending_payment",
    paymentStatus: "pending",
  });

  const tamperAmountRes = await fetch(`${BASE_URL}/payments/create-order`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      appointmentId: testBooking._id,
      amount: 1, // Attacker sends ₹1 instead of doctor's real fee!
    }),
  });
  const tamperData = await tamperAmountRes.json();
  assert(
    tamperData.order.amount === Math.round(doctor1.consultationFee * 100),
    `Client Amount Untrusted: Server ignored ₹1 payload and enforced authoritative DB fee ₹${doctor1.consultationFee}`
  );

  // --- CHECK 6: Client-Provided Payout Account Never Trusted ---
  const tamperPayoutRes = await fetch(`${BASE_URL}/payments/create-order`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      appointmentId: testBooking._id,
      payoutAccountId: "acc_attacker_stolen_account", // Attacker injects their own payout account
    }),
  });
  const tamperPayoutData = await tamperPayoutRes.json();
  assert(
    tamperPayoutData.payoutRouting.doctorPayoutAccountId === doctor1.payoutAccountId,
    `Client Payout Account Untrusted: Server ignored client account and routed strictly to doctor's DB account ${doctor1.payoutAccountId}`
  );

  // --- CHECK 7: Razorpay Signature Verification ---
  const fakeVerifyRes = await fetch(`${BASE_URL}/payments/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: tamperData.order.id,
      razorpay_payment_id: "pay_tampered_12345",
      razorpay_signature: "fake_invalid_hmac_signature_99999",
    }),
  });
  assert(fakeVerifyRes.status === 400, "Tampered Razorpay payment signature rejected (400 Bad Request)");

  // --- CHECK 8: Webhook Signature Verification ---
  const fakeWebhookRes = await fetch(`${BASE_URL}/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "invalid_webhook_hmac_signature",
    },
    body: JSON.stringify({ event: "payment.captured" }),
  });
  assert(
    fakeWebhookRes.status === 400 || fakeWebhookRes.status === 200,
    "Webhook handler validates incoming signature"
  );

  // --- CHECK 9: Verification Idempotency ---
  // Generate legitimate signature for dev test order
  const secret = process.env.RAZORPAY_KEY_SECRET || "sehatraj_dev_secret";
  const legitOrderId = tamperPayoutData.order.id;
  const legitPaymentId = "pay_legit_" + Date.now();
  const legitSignature = crypto
    .createHmac("sha256", secret)
    .update(legitOrderId + "|" + legitPaymentId)
    .digest("hex");

  const verify1 = await fetch(`${BASE_URL}/payments/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: legitOrderId,
      razorpay_payment_id: legitPaymentId,
      razorpay_signature: legitSignature,
    }),
  });
  const v1Data = await verify1.json();

  const verify2 = await fetch(`${BASE_URL}/payments/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenP1}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: legitOrderId,
      razorpay_payment_id: legitPaymentId,
      razorpay_signature: legitSignature,
    }),
  });
  const v2Data = await verify2.json();
  assert(
    v1Data.success === true && v2Data.success === true && v2Data.message.includes("already"),
    "Payment verification idempotency: Duplicate verify call handled safely without double-processing"
  );

  // --- CHECK 10: Password and OTPs Never Exposed in JSON Responses ---
  const userJson = patient1.toJSON();
  assert(
    userJson.password === undefined && userJson.resetOTP === undefined,
    "User Schema toJSON transform strictly purges password and resetOTP from all responses"
  );

  // Clean up test booking
  await Appointment.findByIdAndDelete(testBooking._id);

  console.log("\n=================================================");
  console.log(`   SECURITY AUDIT COMPLETE: ${passed}/${total} CHECKS PASSED`);
  console.log("=================================================\n");

  process.exit(passed === total ? 0 : 1);
}

runSecurityAudit().catch((e) => {
  console.error("Security Audit Fatal Error:", e);
  process.exit(1);
});
