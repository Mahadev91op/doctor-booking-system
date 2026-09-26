const razorpay = require("../config/razorpay");
const Appointment = require("../models/Appointment");
const crypto = require("crypto");
const { sendAppointmentEmail } = require("../services/emailService");
const SUBSCRIPTION_PLANS = require("../config/subscriptionPlans");

const Doctor = require("../models/Doctor");
const DoctorSubscription = require("../models/DoctorSubscription");
const sendNotification = require("../services/notificationService");
const checkDoctorSubscription = require("../utils/checkDoctorSubscription");


const createOrder = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Security check: Only the booking patient can initiate payment
    if (appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to pay for this appointment",
      });
    }

    // Already Paid check
    if (appointment.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment already completed",
      });
    }

    // 1. Authoritative Doctor Lookup (Never trust payout IDs or fees from client payload)
    const doctor = await Doctor.findById(appointment.doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Associated doctor not found",
      });
    }

    // 2. Authoritative Persisted Fee Lookup from Appointment
    let authoritativeFee = appointment.amountDue;

    // Fallback for legacy appointments if amountDue is not populated
    if (typeof authoritativeFee !== "number" || authoritativeFee <= 0) {
      if (appointment.appointmentType === "premium") {
        authoritativeFee = doctor.premiumFee;
      } else if (appointment.appointmentType === "home") {
        authoritativeFee = doctor.homeVisitFee;
      } else {
        authoritativeFee = doctor.consultationFee;
      }
      appointment.amountDue = authoritativeFee;
    }

    if (!authoritativeFee || authoritativeFee <= 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor has not configured valid fees for this appointment type",
      });
    }

    const totalAmountPaise = Math.round(authoritativeFee * 100);

    // 3. Build Razorpay Order Options with Marketplace Payout Routing
    const options = {
      amount: totalAmountPaise,
      currency: "INR",
      receipt: appointment.bookingReference,
      notes: {
        appointmentId: appointment._id.toString(),
        bookingReference: appointment.bookingReference,
        doctorId: doctor._id.toString(),
        doctorName: doctor.name,
      },
    };

    // If doctor has a configured linked payout account, route funds directly to doctor via Razorpay Route
    if (doctor.payoutAccountId) {
      appointment.payoutAccountId = doctor.payoutAccountId;
      appointment.transferAmount = authoritativeFee;

      options.transfers = [
        {
          account: doctor.payoutAccountId,
          amount: totalAmountPaise,
          currency: "INR",
          notes: {
            doctorId: doctor._id.toString(),
            appointmentId: appointment._id.toString(),
            bookingReference: appointment.bookingReference,
          },
        },
      ];
    }

    let order;
    try {
      order = await razorpay.orders.create(options);
      appointment.routingStatus = doctor.payoutAccountId ? "routed" : "direct";
    } catch (orderError) {
      // Defensive fallback for development / test environments where Route transfers might not be enabled
      if (
        options.transfers &&
        (orderError.message?.includes("account") ||
          orderError.message?.includes("transfer") ||
          orderError.statusCode === 400 ||
          orderError.error?.code === "BAD_REQUEST_ERROR")
      ) {
        console.warn(
          "⚠️ Razorpay Route transfer notice:",
          orderError.message || orderError.error?.description,
          "- Creating order in direct mode with routing tag for doctor:",
          doctor.payoutAccountId
        );
        delete options.transfers;
        options.notes.targetPayoutAccount = doctor.payoutAccountId;
        options.notes.routePending = "true";
        order = await razorpay.orders.create(options);
        appointment.routingStatus = "pending_transfer";
      } else if (
        process.env.NODE_ENV !== "production" &&
        orderError.message?.includes("configured in .env")
      ) {
        // Dev fallback when keys are not in .env
        console.warn("⚠️ Using development sandbox order (Razorpay keys not configured in .env)");
        order = {
          id: `order_dev_${Date.now()}`,
          entity: "order",
          amount: totalAmountPaise,
          amount_paid: 0,
          amount_due: totalAmountPaise,
          currency: "INR",
          receipt: appointment.bookingReference,
          status: "created",
          attempts: 0,
          notes: options.notes,
          created_at: Math.floor(Date.now() / 1000),
        };
        appointment.routingStatus = doctor.payoutAccountId ? "routed" : "direct";
      } else {
        throw orderError;
      }
    }

    // Save Razorpay Order & routing state
    appointment.orderId = order.id;
    appointment.paymentStatus = "processing";

    await appointment.save();

    res.status(200).json({
      success: true,
      order,
      appointment,
      payoutRouting: {
        routed: !!doctor.payoutAccountId,
        doctorPayoutAccountId: doctor.payoutAccountId || null,
        transferAmount: authoritativeFee,
        routingStatus: appointment.routingStatus,
      },
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const createSubscriptionOrder = async (req, res) => {
  try {
    const plan = req.body.plan || "monthly";

    const doctor = await Doctor.findOne({
      userId: req.user._id,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const selectedPlan = SUBSCRIPTION_PLANS[plan];

    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan. Supported plans: monthly, quarterly, yearly",
      });
    }

    const amount = selectedPlan.amount;

    // SaaS Subscription payment routes directly to Platform/Admin account (no transfers array)
    let order;
    try {
      order = await razorpay.orders.create({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `SUB${Date.now()}`,
      });
    } catch (rzpErr) {
      console.warn("⚠️ Razorpay subscription order creation failed, falling back to mock sandbox order:", rzpErr.message);
      order = {
        id: `order_dev_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `SUB${Date.now()}`,
        status: "created",
      };
    }

    const subscription = await DoctorSubscription.create({
      doctorId: doctor._id,
      plan,
      amount,
      orderId: order.id,
    });

    res.status(200).json({
      success: true,
      order,
      subscription,
      platformAccountId: "platform_main",
    });
  } catch (error) {
    console.error("createSubscriptionOrder Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || (process.env.NODE_ENV !== "production" ? "sehatraj_dev_secret" : "");

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "RAZORPAY_KEY_SECRET is not configured on server",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (
      generatedSignature !== razorpay_signature &&
      !(process.env.NODE_ENV !== "production" && razorpay_signature === "mock_signature_test")
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature",
      });
    }

    const existingAppt = await Appointment.findOne({ orderId: razorpay_order_id });
    if (!existingAppt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // 1. Patient Ownership Check: Only the booking patient can verify payment
    if (req.user && existingAppt.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to verify payment for this appointment",
      });
    }

    // 2. Payable State Check: Ensure appointment is not already cancelled or completed
    if (["cancelled_by_patient", "cancelled_by_doctor", "cancelled_by_system", "completed", "checked"].includes(existingAppt.status)) {
      return res.status(400).json({
        success: false,
        message: `Appointment cannot be paid because it is already ${existingAppt.status}`,
      });
    }

    // 3. Idempotent check: If already paid, return existing verified appointment
    if (existingAppt.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already completed and verified",
        appointment: existingAppt,
      });
    }

    // 4. Razorpay API Reconciliation via SDK
    const isMockPayment =
      process.env.NODE_ENV !== "production" &&
      (razorpay_signature === "mock_signature_test" ||
        (typeof razorpay_order_id === "string" && razorpay_order_id.startsWith("order_dev_")) ||
        (typeof razorpay_payment_id === "string" &&
          (razorpay_payment_id.startsWith("pay_test_") ||
            razorpay_payment_id.startsWith("pay_legit_") ||
            razorpay_payment_id.startsWith("pay_dev_"))));

    if (!isMockPayment) {
      let rzpPayment;
      try {
        rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
      } catch (fetchErr) {
        console.error("Razorpay SDK fetch error:", fetchErr);
        return res.status(400).json({
          success: false,
          message: "Unable to reconcile payment with Razorpay: " + (fetchErr.error?.description || fetchErr.message),
        });
      }

      if (!rzpPayment) {
        return res.status(400).json({
          success: false,
          message: "Payment record not found on Razorpay",
        });
      }

      // Check payment status is captured or authorized
      if (!["captured", "authorized"].includes(rzpPayment.status)) {
        return res.status(400).json({
          success: false,
          message: `Payment status invalid: payment is ${rzpPayment.status}`,
        });
      }

      // Check payment belongs to this order
      if (rzpPayment.order_id !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          message: "Payment does not match the requested order ID",
        });
      }

      // Check payment amount and currency match authoritative fee
      const expectedAmountPaise = Math.round((existingAppt.amountDue || existingAppt.amountPaid) * 100);
      if (rzpPayment.amount !== expectedAmountPaise || rzpPayment.currency !== "INR") {
        return res.status(400).json({
          success: false,
          message: `Payment amount/currency mismatch. Expected ${expectedAmountPaise} INR (in paise), received ${rzpPayment.amount} ${rzpPayment.currency}`,
        });
      }
    }

    // 5. Conditional Atomic State Transition
    // Match only if status is pending_payment and paymentStatus is pending or processing
    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: existingAppt._id,
        orderId: razorpay_order_id,
        status: "pending_payment",
        paymentStatus: { $in: ["pending", "processing"] },
      },
      {
        $set: {
          paymentStatus: "paid",
          status: "confirmed",
          amountPaid: existingAppt.amountDue || existingAppt.amountPaid || 0,
          paymentId: razorpay_payment_id,
          paymentMethod: "razorpay",
          paymentCompletedAt: new Date(),
        },
      },
      { new: true }
    );

    console.log("========== VERIFY PAYMENT ==========");
    console.log("Razorpay Order:", razorpay_order_id);

    if (!appointment) {
      // Re-query to determine whether another concurrent request already confirmed it
      const concurrentCheck = await Appointment.findById(existingAppt._id);
      if (concurrentCheck && concurrentCheck.paymentStatus === "paid") {
        return res.status(200).json({
          success: true,
          message: "Payment already verified and confirmed",
          appointment: concurrentCheck,
        });
      }
      return res.status(409).json({
        success: false,
        message: "Appointment state conflict: unable to complete payment transition",
      });
    }

    // Check if post-payment routing transfer is needed
    if (appointment.payoutAccountId && appointment.routingStatus === "pending_transfer") {
      try {
        const transfer = await razorpay.payments.transfer(razorpay_payment_id, {
          transfers: [
            {
              account: appointment.payoutAccountId,
              amount: Math.round((appointment.amountDue || appointment.amountPaid) * 100),
              currency: "INR",
              notes: {
                appointmentId: appointment._id.toString(),
                bookingReference: appointment.bookingReference,
              },
            },
          ],
        });
        if (transfer && transfer.items && transfer.items.length > 0) {
          appointment.transferId = transfer.items[0].id;
          appointment.routingStatus = "routed";
          await appointment.save();
        }
      } catch (transferErr) {
        console.warn("⚠️ Post-payment Route transfer note:", transferErr.message);
      }
    }

    console.log("Appointment Found:", appointment._id);
    console.log("After Save Payment Status:", appointment.paymentStatus);
    console.log("========== PAYMENT SAVED ==========");


    // Populate patient & doctor before sending email
    await appointment.populate("patientId", "name email");
    await appointment.populate("doctorId", "name");
    console.log("Sending appointment email...");
    console.log("To:", appointment.patientId.email);

    await sendAppointmentEmail(
      appointment.patientId.email,
      "Appointment Confirmed - SehatRaj",
      appointment.patientId.name,
      appointment.doctorId.name,
      appointment.bookingReference,
      new Date(appointment.appointmentDate).toLocaleDateString(),
      appointment.slotTime || appointment.tokenNumber,
    );
    console.log("Appointment email function completed.");
    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      appointment,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const verifySubscriptionPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || (process.env.NODE_ENV !== "production" ? "sehatraj_dev_secret" : "");

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "RAZORPAY_KEY_SECRET is not configured on server",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (
      generatedSignature !== razorpay_signature &&
      !(process.env.NODE_ENV !== "production" && razorpay_signature === "mock_signature_test")
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature",
      });
    }

    const startDate = new Date();

    const initialSub = await DoctorSubscription.findOne({
      orderId: razorpay_order_id,
    });

    if (!initialSub) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const selectedPlan = SUBSCRIPTION_PLANS[initialSub.plan];
    let expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + selectedPlan.months);

    const subscription = await DoctorSubscription.findOneAndUpdate(
      { orderId: razorpay_order_id, paymentStatus: { $ne: "paid" } },
      {
        $set: {
          paymentStatus: "paid",
          paymentId: razorpay_payment_id,
          startDate: startDate,
          expiryDate: expiryDate,
        },
      },
      { new: true }
    );

    if (!subscription) {
      const existingSub = await DoctorSubscription.findOne({ orderId: razorpay_order_id });
      if (existingSub && existingSub.paymentStatus === "paid") {
        const doctor = await Doctor.findById(existingSub.doctorId);
        return res.status(200).json({
          success: true,
          message: "Subscription already activated",
          doctor,
        });
      }
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const doctor = await Doctor.findOneAndUpdate(
      { _id: subscription.doctorId },
      {
        $set: {
          subscriptionStatus: "active",
          subscriptionPlan: subscription.plan,
          subscriptionStartDate: startDate,
          subscriptionExpiryDate: expiryDate,
          subscriptionAmount: subscription.amount,
        }
      },
      { new: true }
    );

    try {
      await sendNotification(
        doctor.userId,
        "Subscription Activated",
        `Your ${subscription.plan} subscription (₹${subscription.amount}) has been activated successfully until ${expiryDate.toLocaleDateString()}. Practice profile is now active!`,
        "subscription"
      );
    } catch (notifErr) {}

    res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      doctor,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDoctorSubscriptionStatus = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({
      userId: req.user._id,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    await checkDoctorSubscription(doctor);

    const subscriptions = await DoctorSubscription.find({
      doctorId: doctor._id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    const now = new Date();
    const expiryDateVal =
      doctor.subscriptionStatus === "trial"
        ? doctor.trialEndDate || doctor.subscriptionExpiryDate
        : doctor.subscriptionExpiryDate;

    let remainingDays = 0;
    if (expiryDateVal) {
      const diff = new Date(expiryDateVal) - now;
      remainingDays = Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
    }

    res.status(200).json({
      success: true,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        subscriptionStatus: doctor.subscriptionStatus,
        subscriptionPlan: doctor.subscriptionPlan,
        trialStartDate: doctor.trialStartDate,
        trialEndDate: doctor.trialEndDate,
        subscriptionStartDate: doctor.subscriptionStartDate,
        subscriptionExpiryDate: doctor.subscriptionExpiryDate,
        subscriptionAmount: doctor.subscriptionAmount,
        billingCycle: doctor.billingCycle,
        remainingDays,
      },
      plans: SUBSCRIPTION_PLANS,
      history: subscriptions,
    });
  } catch (error) {
    console.error("getDoctorSubscriptionStatus Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (process.env.NODE_ENV === "production" && (!signature || !secret)) {
      return res.status(400).json({
        success: false,
        message: "Missing signature or secret",
      });
    }

    if (signature && secret) {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest("hex");

      if (expectedSignature !== signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature",
        });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload || {};
    const paymentEntity = payload.payment?.entity;
    const orderEntity = payload.order?.entity;
    const transferEntity = payload.transfer?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;

    console.log(`📡 Razorpay Webhook Event: ${event} | Order: ${orderId || "N/A"} | Payment: ${paymentId || "N/A"}`);

    // 1. Payment Captured or Order Paid
    if (event === "payment.captured" || event === "order.paid") {
      if (orderId) {
        // A. Appointment Processing (Marketplace Flow)
        const existingAppt = await Appointment.findOne({ orderId });

        if (existingAppt && existingAppt.paymentStatus !== "paid") {
          const appointment = await Appointment.findOneAndUpdate(
            {
              _id: existingAppt._id,
              orderId,
              status: "pending_payment",
              paymentStatus: { $in: ["pending", "processing"] },
            },
            {
              $set: {
                paymentStatus: "paid",
                status: "confirmed",
                amountPaid: existingAppt.amountDue || existingAppt.amountPaid || 0,
                ...(paymentId ? { paymentId } : {}),
                paymentMethod: "razorpay",
                paymentCompletedAt: new Date(),
              },
            },
            { new: true }
          );

          if (appointment) {

            // Check if post-payment routing transfer is needed
            if (appointment.payoutAccountId && appointment.routingStatus === "pending_transfer" && paymentId) {
              try {
                const transfer = await razorpay.payments.transfer(paymentId, {
                  transfers: [
                    {
                      account: appointment.payoutAccountId,
                      amount: Math.round(appointment.amountPaid * 100),
                      currency: "INR",
                      notes: {
                        appointmentId: appointment._id.toString(),
                        bookingReference: appointment.bookingReference,
                      },
                    },
                  ],
                });
                if (transfer && transfer.items && transfer.items.length > 0) {
                  appointment.transferId = transfer.items[0].id;
                  appointment.routingStatus = "routed";
                }
              } catch (transferErr) {
                console.warn("⚠️ Webhook Route transfer note:", transferErr.message);
              }
            }

            await appointment.save();

            // Send Confirmation Email
            await appointment.populate("patientId", "name email");
            await appointment.populate("doctorId", "name");

            if (appointment.patientId && appointment.patientId.email) {
              await sendAppointmentEmail(
                appointment.patientId.email,
                "Appointment Confirmed - SehatRaj",
                appointment.patientId.name,
                appointment.doctorId.name,
                appointment.bookingReference,
                new Date(appointment.appointmentDate).toLocaleDateString(),
                appointment.slotTime || appointment.tokenNumber
              );
            }
          }
          return res.status(200).json({ success: true, message: "Appointment updated via webhook" });
        }

        // B. Doctor SaaS Subscription Processing
        const subscription = await DoctorSubscription.findOne({ orderId });

        if (subscription) {
          if (subscription.paymentStatus !== "paid") {
            const startDate = new Date();
            const selectedPlan = SUBSCRIPTION_PLANS[subscription.plan];
            let expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + (selectedPlan?.months || 1));

            subscription.paymentStatus = "paid";
            if (paymentId) subscription.paymentId = paymentId;
            subscription.startDate = startDate;
            subscription.expiryDate = expiryDate;
            await subscription.save();

            await Doctor.findOneAndUpdate(
              { _id: subscription.doctorId },
              {
                $set: {
                  subscriptionStatus: "active",
                  subscriptionPlan: subscription.plan,
                  subscriptionStartDate: startDate,
                  subscriptionExpiryDate: expiryDate,
                  subscriptionAmount: subscription.amount,
                },
              }
            );
          }
          return res.status(200).json({ success: true, message: "Subscription updated via webhook" });
        }
      }
    } else if (event === "payment.failed") {
      if (orderId) {
        const appointment = await Appointment.findOne({ orderId });
        if (appointment && appointment.paymentStatus !== "paid") {
          appointment.paymentStatus = "failed";
          await appointment.save();
        }

        const subscription = await DoctorSubscription.findOne({ orderId });
        if (subscription && subscription.paymentStatus !== "paid") {
          subscription.paymentStatus = "failed";
          await subscription.save();
        }
      }
    } else if (event === "transfer.processed") {
      // 2. Razorpay Route Transfer Success
      if (transferEntity) {
        const notesAppointmentId = transferEntity.notes?.appointmentId;
        const transferId = transferEntity.id;
        const recipientAccount = transferEntity.recipient;

        let query = {};
        if (notesAppointmentId) {
          query._id = notesAppointmentId;
        } else if (recipientAccount) {
          query.payoutAccountId = recipientAccount;
          query.routingStatus = { $ne: "routed" };
        }

        const appt = await Appointment.findOne(query);
        if (appt) {
          appt.transferId = transferId;
          appt.routingStatus = "routed";
          await appt.save();
          console.log(`✅ Route transfer processed for appointment: ${appt._id} to account: ${recipientAccount}`);
        }
      }
    } else if (event === "transfer.failed") {
      // 3. Razorpay Route Transfer Failure
      if (transferEntity) {
        const notesAppointmentId = transferEntity.notes?.appointmentId;
        if (notesAppointmentId) {
          await Appointment.findByIdAndUpdate(notesAppointmentId, {
            routingStatus: "failed_transfer",
          });
          console.warn(`⚠️ Route transfer failed for appointment: ${notesAppointmentId}`);
        }
      }
    }

    res.status(200).json({ success: true, message: "Webhook received and processed" });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getDoctorSubscriptionStatus,
  razorpayWebhook,
};
