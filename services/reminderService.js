const cron = require("node-cron");

const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

const { sendEmail } = require("./emailService");
const reminderEmail = require("../templates/reminderEmail");

const startReminderService = () => {
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("⏰ Checking appointment reminders...");

      const now = new Date();

      const appointments = await Appointment.find({
        appointmentType: "premium",
        status: "confirmed",
        reminder24Sent: false,
      });

      for (const appointment of appointments) {
        const patient = await User.findById(appointment.patientId);
        const doctor = await Doctor.findById(appointment.doctorId);

        if (!patient || !doctor) {
          console.log(
            `⚠️ Skipping appointment ${appointment.bookingReference} (Patient or Doctor not found)`,
          );
          continue;
        }

        // Create appointment date & time
        const appointmentDateTime = new Date(appointment.slotDate);

        const [hours, minutes] = appointment.slotTime.split(":").map(Number);

        appointmentDateTime.setHours(hours, minutes, 0, 0);

        const diff = appointmentDateTime.getTime() - now.getTime();

        // Send reminder within 24 hours
        if (diff > 0 && diff <= 24 * 60 * 60 * 1000) {
          console.log(
            `📩 Sending reminder for ${appointment.bookingReference}`,
          );

          await sendEmail({
            to: patient.email,
            subject: "Appointment Reminder",
            html: reminderEmail(
              patient.name,
              doctor.name,
              appointment.slotDate.toDateString(),
              appointment.slotTime,
            ),
          });

          appointment.reminder24Sent = true;
          await appointment.save();

          console.log(`✅ Reminder sent to ${patient.email}`);
        }
      }
    } catch (error) {
      console.error("❌ Reminder Service Error:", error);
    }
  });

  // Check doctor trial and subscription expirations every hour
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("⏰ Checking doctor trial and subscription expirations...");
      const now = new Date();

      // Expire trials past trialEndDate or subscriptionExpiryDate
      const expiredTrials = await Doctor.find({
        subscriptionStatus: "trial",
        $or: [
          { trialEndDate: { $lt: now } },
          { subscriptionExpiryDate: { $lt: now } },
        ],
      });

      for (const doctor of expiredTrials) {
        doctor.subscriptionStatus = "expired";
        await doctor.save();
        console.log(`ℹ️ Doctor ${doctor.name} 30-day trial expired`);
      }

      // Expire active subscriptions past expiry date
      const expiredSubs = await Doctor.find({
        subscriptionStatus: "active",
        subscriptionExpiryDate: { $lt: now },
      });

      for (const doctor of expiredSubs) {
        doctor.subscriptionStatus = "expired";
        await doctor.save();
        console.log(`ℹ️ Doctor ${doctor.name} subscription expired`);
      }
    } catch (err) {
      console.error("❌ Subscription Expiry Cron Error:", err);
    }
  });
};

module.exports = {
  startReminderService,
};
