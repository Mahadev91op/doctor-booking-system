const Appointment = require("../models/Appointment");
const checkDoctorSubscription = require("../utils/checkDoctorSubscription");
const sendNotification = require("../services/notificationService");
const { sendEmail, sendAppointmentEmail } = require("../services/emailService");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const DailyCounter = require("../models/DailyCounter");
const razorpay = require("../config/razorpay");

const createNormalAppointment = async (req, res) => {
  let counterIdToRollback = null;
  try {
    const { doctorId, date, slotDate, appointmentDate, slotTime, time } = req.body;

    const patientId = req.user._id;
    // Find doctor
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }
    await checkDoctorSubscription(doctor);

    if (!["active", "trial", "adminApproved"].includes(doctor.subscriptionStatus)) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently unavailable due to inactive subscription.",
      });
    }

    // Vacation Check
    if (doctor.vacationMode) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently on vacation",
      });
    }

    // 1. Date Validation
    const targetDateStr = date || slotDate || appointmentDate;
    const bookingDate = targetDateStr ? new Date(targetDateStr) : new Date();

    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking date provided",
      });
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const bookingDateMidnight = new Date(
      bookingDate.getFullYear(),
      bookingDate.getMonth(),
      bookingDate.getDate()
    );

    if (bookingDateMidnight < todayMidnight) {
      return res.status(400).json({
        success: false,
        message: "Past dates cannot be booked",
      });
    }

    // 2. Doctor Configured Working Days Validation
    const dayName = bookingDate.toLocaleDateString("en-US", { weekday: "long" });
    const doctorWorkingDays =
      doctor.workingDays && doctor.workingDays.length > 0
        ? doctor.workingDays
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    if (!doctorWorkingDays.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: `Doctor does not consult on ${dayName}`,
      });
    }

    // 3. Clinic Operating Hours & Lunch Interval Validation
    const clinicStart = doctor.clinicStartTime || "09:00";
    const clinicEnd = doctor.clinicEndTime || "18:00";
    const lunchStartStr = doctor.lunchStart || "13:00";
    const lunchEndStr = doctor.lunchEnd || "14:00";
    const slotDuration = doctor.slotDuration || 20;

    const requestedSlotTime = slotTime || time;

    if (requestedSlotTime) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(requestedSlotTime)) {
        return res.status(400).json({
          success: false,
          message: "Invalid slot time format. Expected HH:mm (24-hour format)",
        });
      }

      if (requestedSlotTime < clinicStart || requestedSlotTime >= clinicEnd) {
        return res.status(400).json({
          success: false,
          message: `Requested slot time ${requestedSlotTime} is outside clinic operating hours (${clinicStart} - ${clinicEnd})`,
        });
      }

      const [sH, sM] = requestedSlotTime.split(":").map(Number);
      const slotMinutes = sH * 60 + sM;
      const [lSH, lSM] = lunchStartStr.split(":").map(Number);
      const [lEH, lEM] = lunchEndStr.split(":").map(Number);
      const lunchStartMin = lSH * 60 + lSM;
      const lunchEndMin = lEH * 60 + lEM;

      if (slotMinutes >= lunchStartMin && slotMinutes < lunchEndMin) {
        return res.status(400).json({
          success: false,
          message: `Doctor is unavailable during lunch break (${lunchStartStr} - ${lunchEndStr})`,
        });
      }

      const [cSH, cSM] = clinicStart.split(":").map(Number);
      const clinicStartMin = cSH * 60 + cSM;
      if ((slotMinutes - clinicStartMin) % slotDuration !== 0) {
        return res.status(400).json({
          success: false,
          message: `Requested slot time must align with the doctor's ${slotDuration}-minute slot interval starting from ${clinicStart}`,
        });
      }
    }

    // 4. Authoritative Fee Check
    const authoritativeFee = doctor.consultationFee;
    if (typeof authoritativeFee !== "number" || authoritativeFee <= 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor consultation fee is not configured properly",
      });
    }

    // 5. Daily Capacity Enforcement & Token Generation
    const maxCapacity = doctor.maxNormalAppointments || 50;
    const counterId = `normal_${doctorId}_${bookingDateMidnight.getTime()}`;
    const nextToken = await DailyCounter.incrementAndCheckLimit(counterId, maxCapacity);

    if (!nextToken) {
      return res.status(400).json({
        success: false,
        message: "Maximum appointments reached for this day",
      });
    }

    counterIdToRollback = counterId;

    // 6. Appointment Persistence with rollback protection
    const appointment = await Appointment.create({
      patientId,
      doctorId,
      appointmentType: "normal",
      amountDue: authoritativeFee,
      amountPaid: 0,
      tokenNumber: nextToken,
      appointmentDate: bookingDate,
      ...(requestedSlotTime ? { slotTime: requestedSlotTime } : {}),
    });

    counterIdToRollback = null; // Successfully persisted, no rollback needed

    res.status(201).json({
      success: true,
      tokenNumber: nextToken,
      appointment,
    });
  } catch (error) {
    // Defect 4 Fix: Compensation rollback if appointment creation/persistence failed
    if (counterIdToRollback) {
      try {
        await DailyCounter.decrementToken(counterIdToRollback);
      } catch (rollbackErr) {
        console.error("Failed to decrement counter during rollback:", rollbackErr);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const createPremiumAppointment = async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const { doctorId, slotDate, slotTime } = req.body;
    const patientId = req.user._id;
    console.log("Logged in user:", req.user);
    // 1. Find doctor
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (
      doctor.subscriptionStatus === "expired" ||
      doctor.subscriptionStatus === "suspended"
    ) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently unavailable.",
      });
    }
    // Vacation Check
    if (doctor.vacationMode) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently on vacation",
      });
    }
    if (!doctor.premiumBookingEnabled) {
      return res.status(400).json({
        success: false,
        message: "Premium booking is disabled for this doctor",
      });
    }
    const start = doctor.premiumStartTime || doctor.clinicStartTime || "09:00";
    const end = doctor.premiumEndTime || doctor.clinicEndTime || "18:00";

    if (slotTime < start || slotTime >= end) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot selected",
      });
    }
    const bookingDate = new Date(slotDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Check Working Day
    const dayName = bookingDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const workingDays =
      doctor.premiumWorkingDays && doctor.premiumWorkingDays.length > 0
        ? doctor.premiumWorkingDays
        : [];

    if (!workingDays.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: `Doctor does not provide Premium Consultation on ${dayName}`,
      });
    }
    // Lunch Break Validation
    const lunchStartStr = doctor.lunchStart || "13:00";
    const lunchEndStr = doctor.lunchEnd || "14:00";
    const slotMinutes =
      Number(slotTime.split(":")[0]) * 60 + Number(slotTime.split(":")[1]);

    const lunchStartMinutes =
      Number(lunchStartStr.split(":")[0]) * 60 +
      Number(lunchStartStr.split(":")[1]);

    const lunchEndMinutes =
      Number(lunchEndStr.split(":")[0]) * 60 +
      Number(lunchEndStr.split(":")[1]);

    if (slotMinutes >= lunchStartMinutes && slotMinutes < lunchEndMinutes) {
      return res.status(400).json({
        success: false,
        message: "Doctor is unavailable during lunch break",
      });
    }

    // Slot alignment validation with premiumSlotDuration
    const premiumDuration = doctor.premiumSlotDuration || 20;
    const [startH, startM] = start.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    if ((slotMinutes - startMinutes) % premiumDuration !== 0) {
      return res.status(400).json({
        success: false,
        message: `Slot time must align with the doctor's ${premiumDuration}-minute premium slot interval starting from ${start}`,
      });
    }
    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: "Past dates cannot be booked",
      });
    }
    // 2. Check subscription
   await checkDoctorSubscription(doctor);

   if (!["active", "trial"].includes(doctor.subscriptionStatus)) {
     return res.status(400).json({
       success: false,
       message: "Doctor is currently unavailable",
     });
   }

    // 3. Check duplicate booking atomically and limit check

    // Check Daily Premium Limit atomically
    const counterId = `premium_${doctorId}_${new Date(slotDate).getTime()}`;
    const maxPremiumLimit = doctor.maxPremiumAppointments || 20;
    const limitReached = !(await DailyCounter.incrementAndCheckLimit(counterId, maxPremiumLimit));

    if (limitReached) {
      return res.status(400).json({
        success: false,
        message: "Maximum premium appointments reached for this day",
      });
    }

    const bookingRef = "BK" + Date.now() + Math.floor(Math.random() * 1000);

    const authoritativeFee = doctor.premiumFee;
    if (typeof authoritativeFee !== "number" || authoritativeFee <= 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor premium consultation fee is not configured properly",
      });
    }

    const appointment = await Appointment.findOneAndUpdate(
      {
        doctorId,
        slotDate: new Date(slotDate),
        slotTime,
        appointmentType: "premium",
        status: {
          $in: ["booked", "checked", "completed", "rescheduled", "pending_payment"],
        },
      },
      {
        $setOnInsert: {
          patientId,
          doctorId,
          appointmentType: "premium",
          slotDate,
          slotTime,
          paymentStatus: "pending",
          amountDue: authoritativeFee,
          amountPaid: 0,
          status: "pending_payment",
          bookingReference: bookingRef,
        },
      },
      { upsert: true, new: true }
    );

    if (appointment.bookingReference !== bookingRef) {
      await DailyCounter.decrementToken(counterId);
      return res.status(400).json({
        success: false,
        message: "This slot is already booked",
      });
    }
    // Send notification to doctor
    await sendNotification(
      doctor.userId,
      "New Premium Appointment",
      `You have received a new premium appointment for ${slotDate} at ${slotTime}.`,
      "appointment",
    );
    // Send email to patient

   
    res.status(201).json({
      success: true,
      message: "Premium appointment booked successfully",
      bookingReference: appointment.bookingReference,
      appointment,
    });
  } catch (error) {
    if (counterId) {
      await DailyCounter.decrementToken(counterId).catch(() => {});
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This premium slot has already been reserved",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


 const createHomeVisitAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      visitDate,
      slotTime,
      homeVisitAddress,
      homeVisitLandmark,
      homeVisitCity,
      homeVisitPincode,
    } = req.body;
    const bookingDate = new Date(visitDate);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: "Past dates cannot be booked.",
      });
    }
    const patientId = req.user._id;

    // Find doctor
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Vacation Check
    if (doctor.vacationMode) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently on vacation",
      });
    }

    // Home Visit Availability
    if (!doctor.homeVisitAvailable) {
      return res.status(400).json({
        success: false,
        message: "Home visit is not available for this doctor",
      });
    }

    // Subscription Check
    await checkDoctorSubscription(doctor);

    if (
      !["active", "trial", "adminApproved"].includes(
        doctor.subscriptionStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Doctor is currently unavailable due to inactive subscription.",
      });
    }

    // Check Working Day strictly against homeVisitWorkingDays
    const dayName = bookingDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const homeVisitWorkingDays =
      doctor.homeVisitWorkingDays && doctor.homeVisitWorkingDays.length > 0
        ? doctor.homeVisitWorkingDays
        : [];

    if (!homeVisitWorkingDays.includes(dayName)) {
      return res.status(400).json({
        success: false,
        message: `Doctor does not provide Home Visits on ${dayName}`,
      });
    }

    // Home Visit Operating Hours and Slot Alignment
    const start = doctor.homeVisitStartTime || "16:00";
    const end = doctor.homeVisitEndTime || "19:00";
    const duration = doctor.homeVisitSlotDuration || 30;

    if (slotTime < start || slotTime >= end) {
      return res.status(400).json({
        success: false,
        message: `Slot time ${slotTime} is outside doctor's home visit hours (${start} - ${end})`,
      });
    }

    const [sH, sM] = slotTime.split(":").map(Number);
    const slotMinutes = sH * 60 + sM;
    const [startH, startM] = start.split(":").map(Number);
    const startMinutes = startH * 60 + startM;

    if ((slotMinutes - startMinutes) % duration !== 0) {
      return res.status(400).json({
        success: false,
        message: `Home visit slot time must align with ${duration}-minute intervals starting from ${start}`,
      });
    }

    // Check Daily Home Visit Limit atomically
    const selectedDate = new Date(visitDate);
    selectedDate.setHours(0, 0, 0, 0);

    const counterId = `home_${doctorId}_${selectedDate.getTime()}`;
    const maxHomeVisits = doctor.maxHomeVisits || 5;
    const limitReached = !(await DailyCounter.incrementAndCheckLimit(counterId, maxHomeVisits));

    if (limitReached) {
      return res.status(400).json({
        success: false,
        message: "Maximum home visits reached for today",
      });
    }

    const bookingRef = "BK" + Date.now() + Math.floor(Math.random() * 1000);

    const authoritativeFee = doctor.homeVisitFee;
    if (typeof authoritativeFee !== "number" || authoritativeFee <= 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor home visit fee is not configured properly",
      });
    }

    const appointment = await Appointment.findOneAndUpdate(
      {
        doctorId,
        slotDate: new Date(visitDate),
        slotTime,
        appointmentType: "home",
        status: {
          $in: ["booked", "checked", "completed", "rescheduled", "pending_payment"],
        },
      },
      {
        $setOnInsert: {
          patientId,
          doctorId,
          appointmentType: "home",
          slotDate: new Date(visitDate),
          slotTime,
          homeVisitAddress,
          homeVisitLandmark,
          homeVisitCity,
          homeVisitPincode,
          doctorResponse: "pending",
          amountDue: authoritativeFee,
          amountPaid: 0,
          paymentStatus: "pending",
          status: "pending_payment",
          bookingReference: bookingRef,
        },
      },
      { upsert: true, new: true }
    );

    if (appointment.bookingReference !== bookingRef) {
      await DailyCounter.decrementToken(counterId);
      return res.status(400).json({
        success: false,
        message: "This slot is already booked",
      });
    }

    // Notify Doctor
   await sendNotification(
     doctor.userId,
     "New Home Visit Request",
     `A patient has requested a home visit in ${homeVisitCity}.`,
     "homeVisit",
   );
const patient = await User.findById(patientId);

await sendAppointmentEmail(
  patient.email,
  "Home Visit Request",
  patient.name,
  doctor.name,
  appointment.bookingReference,
  appointment.slotDate,
  appointment.slotTime,
);     
    res.status(201).json({
      success: true,
      message: "Home visit appointment created",
      bookingReference: appointment.bookingReference,
      appointment,
    });
  } catch (error) {
    if (counterId) {
      await DailyCounter.decrementToken(counterId).catch(() => {});
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This home visit slot has already been reserved",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      doctorId: req.params.doctorId,
    })
      .populate("patientId", "name mobile email")
      .sort({ tokenNumber: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const markAppointmentChecked = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Only doctors can mark appointments as checked",
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Doctor ownership check
    if (appointment.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to check in for another doctor's appointment",
      });
    }

    // Defect 9 Fix: Preconditions requiring both confirmed status and paid payment status
    if (appointment.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Cannot check in appointment: Payment has not been completed",
      });
    }

    if (appointment.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: `Invalid state transition: Cannot mark as checked from status '${appointment.status}'. Only confirmed appointments can be checked in.`,
      });
    }

    // Defect 10 Fix: Atomic conditional state machine transition
    const updatedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        doctorId: doctor._id,
        status: "confirmed",
        paymentStatus: "paid",
      },
      {
        $set: {
          status: "checked",
        },
      },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(409).json({
        success: false,
        message: "Appointment state conflict: unable to complete check-in transition",
      });
    }

    res.status(200).json({
      success: true,
      message: "Appointment checked successfully",
      appointment: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const cancelAppointment = async (req, res) => {
  try {
    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Only booking patient can cancel (Authorization check first)
    if (appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this appointment",
      });
    }

    // Chronological cancellation check
    const appointmentDate = new Date(appointment.slotDate || appointment.appointmentDate);
    if (appointment.slotTime) {
      const [hours, minutes] = appointment.slotTime.split(':');
      appointmentDate.setHours(Number(hours), Number(minutes), 0, 0);
    }
    
    if (appointmentDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an appointment that has already passed",
      });
    }

    if (
      appointment.status === "completed" ||
      appointment.status === "checked"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an appointment that has already been attended",
      });
    }

    // Already cancelled
    if (
      appointment.status === "cancelled_by_patient" ||
      appointment.status === "cancelled_by_doctor"
    ) {
      return res.status(400).json({
        success: false,
        message: "Appointment already cancelled",
      });
    }

    // Patient
    const patient = await User.findById(appointment.patientId);

    // Doctor Profile
    const doctor = await Doctor.findById(appointment.doctorId);

    if (!patient || !doctor) {
      return res.status(404).json({
        success: false,
        message: "Patient or Doctor not found",
      });
    }

    // Doctor Login Account
    const doctorUser = await User.findById(doctor.userId);

    // Defect 10 Fix: Atomic conditional state machine transition for cancellation
    const updatedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        patientId: req.user._id,
        status: { $in: ["pending_payment", "confirmed", "rescheduled"] },
      },
      {
        $set: {
          status: "cancelled_by_patient",
          cancelReason: reason || "",
          cancelledBy: "patient",
          cancelledAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(409).json({
        success: false,
        message: "Appointment state conflict: Cannot cancel an appointment that is already checked, completed, or cancelled",
      });
    }

    if (updatedAppointment.paymentStatus === "paid" && updatedAppointment.paymentId) {
      try {
        const refund = await razorpay.payments.refund(updatedAppointment.paymentId, {
          amount: Math.round((updatedAppointment.amountPaid || updatedAppointment.amountDue) * 100),
        });
        updatedAppointment.refundId = refund.id;
        updatedAppointment.paymentStatus = "refund_pending";
        await updatedAppointment.save();
      } catch (refundError) {
        console.error("Refund failed:", refundError);
      }
    }

    // Send Notification
    if (doctorUser) {
      await sendNotification(
        doctorUser._id,
        "Appointment Cancelled",
        `${patient.name} cancelled the appointment scheduled on ${appointment.slotDate.toDateString()} at ${appointment.slotTime}.`,
        "appointment",
      );
    }

    // Email Patient
    if (patient.email) {
      await sendEmail({
        to: patient.email,
        subject: "Appointment Cancelled",
        html: cancellationEmail(
          patient.name,
          doctor.name,
          appointment.slotDate.toDateString(),
          appointment.slotTime,
          appointment.bookingReference,
        ),
      });
    }

    // Email Doctor
    if (doctorUser && doctorUser.email) {
      await sendEmail({
        to: doctorUser.email,
        subject: "Patient Cancelled Appointment",
        html: doctorCancellationEmail(
          doctor.name,
          patient.name,
          appointment.slotDate.toDateString(),
          appointment.slotTime,
          appointment.bookingReference,
        ),
      });
    }

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      appointment,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getAppointmentTicket = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patientId", "name mobile email")
      .populate(
        "doctorId",
        "name specialization clinicName clinicAddress consultationFee premiumFee homeVisitFee",
      );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // IDOR Protection: Patient can only view their own ticket; Doctor can view their appointments; Admin can view all
    const patientIdStr = appointment.patientId?._id ? appointment.patientId._id.toString() : appointment.patientId?.toString();
    const isPatient = patientIdStr && patientIdStr === req.user._id.toString();
    let isDoctor = false;
    if (req.user.role === "doctor") {
      const doctorProfile = await Doctor.findOne({ userId: req.user._id });
      if (doctorProfile) {
        const doctorIdStr = appointment.doctorId?._id ? appointment.doctorId._id.toString() : appointment.doctorId?.toString();
        isDoctor = doctorIdStr && doctorIdStr === doctorProfile._id.toString();
      }
    }
    const isAdmin = req.user.role === "admin";

    if (!isPatient && !isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to view this ticket",
      });
    }

    if (appointment.paymentStatus !== "paid" && appointment.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed. Ticket unavailable.",
      });
    }

    res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createNormalAppointment,
  getDoctorAppointments,
  markAppointmentChecked,
  createPremiumAppointment,
  createHomeVisitAppointment,
  cancelAppointment,
  getAppointmentTicket,
};