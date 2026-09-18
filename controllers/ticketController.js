const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const checkTicketAuthorization = async (appointment, user) => {
  if (!user) return false;
  if (user.role === "admin") return true;

  const patientIdStr = appointment.patientId?._id
    ? appointment.patientId._id.toString()
    : appointment.patientId?.toString();
  if (patientIdStr && patientIdStr === user._id.toString()) return true;

  if (user.role === "doctor") {
    const doctorProfile = await Doctor.findOne({ userId: user._id });
    if (doctorProfile) {
      const doctorIdStr = appointment.doctorId?._id
        ? appointment.doctorId._id.toString()
        : appointment.doctorId?.toString();
      if (doctorIdStr && doctorIdStr === doctorProfile._id.toString()) return true;
    }
  }

  return false;
};

const getTicket = async (req, res) => {
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
        message: "Ticket not found",
      });
    }

    const isAuthorized = await checkTicketAuthorization(appointment, req.user);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to access this ticket",
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

const downloadTicket = async (req, res) => {
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

    const isAuthorized = await checkTicketAuthorization(appointment, req.user);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You do not have permission to download this ticket",
      });
    }

    if (appointment.paymentStatus !== "paid" && appointment.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed. Ticket unavailable.",
      });
    }

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    const filename = `Ticket-${appointment.bookingReference || appointment._id}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // ===== Header =====
    doc.fontSize(28).fillColor("#2563EB").text("SehatRaj", {
      align: "center",
    });

    doc
      .fontSize(12)
      .fillColor("gray")
      .text("Healthcare & Doctor Consultation Services", {
        align: "center",
      });

    doc.moveDown(0.5);

    doc.fontSize(16).fillColor("green").text("APPOINTMENT CONFIRMED", {
      align: "center",
    });

    doc.moveDown(1.5);

    // ===== Ticket Details =====
    doc.fontSize(12).fillColor("black");

    doc.text(`Booking Reference : ${appointment.bookingReference || appointment._id}`);
    doc.text(`Patient Name      : ${appointment.patientId?.name || "Patient"}`);
    doc.text(`Patient Contact   : ${appointment.patientId?.mobile || appointment.patientId?.email || "N/A"}`);
    doc.text(`Doctor Name       : ${appointment.doctorId?.name || "Doctor"}`);
    doc.text(`Specialization    : ${appointment.doctorId?.specialization || "General"}`);
    doc.text(`Clinic            : ${appointment.doctorId?.clinicName || "Clinic"}`);
    doc.text(`Clinic Address    : ${appointment.doctorId?.clinicAddress || "N/A"}`);
    doc.text(
      `Appointment Type  : ${
        appointment.appointmentType === "normal"
          ? "Normal Consultation"
          : appointment.appointmentType === "premium"
          ? "Premium Consultation"
          : "Home Visit"
      }`
    );

    if (appointment.appointmentType === "normal") {
      doc.text(`Token Number      : #${appointment.tokenNumber || 1}`);
      doc.text(
        `Appointment Date  : ${new Date(
          appointment.appointmentDate || appointment.createdAt
        ).toLocaleDateString()}`
      );
    } else {
      doc.text(
        `Appointment Date  : ${new Date(
          appointment.slotDate || appointment.appointmentDate
        ).toLocaleDateString()}`
      );
      doc.text(`Appointment Time  : ${appointment.slotTime || "Scheduled"}`);
    }

    doc.text(`Amount Paid       : Rs. ${appointment.amountPaid || 0}`);
    doc.text(`Payment Status    : ${appointment.paymentStatus || "paid"}`);
    doc.text(`Booking Status    : ${appointment.status || "confirmed"}`);

    doc.moveDown(2);

    // ===== Patient Instructions =====
    doc.fontSize(13).fillColor("#2563EB").text("Patient Instructions", {
      underline: true,
    });

    doc.moveDown(0.5);

    doc.fontSize(10).fillColor("black");
    doc.text("- Please arrive at least 15 minutes before your scheduled appointment time.");
    doc.text("- Present this printed ticket or digital copy at the clinic reception.");
    doc.text("- Carry your previous medical prescriptions, lab reports, and doctor notes.");
    doc.text("- Follow all clinic and doctor guidelines during your consultation.");

    doc.moveDown(2);

    doc.fontSize(11).fillColor("#2563EB").text("Need Help / Support?", {
      align: "center",
    });

    doc.fontSize(9).fillColor("gray");
    doc.text("Helpline : +91-9149852051", { align: "center" });
    doc.text("Email    : support@sehatraj.com", { align: "center" });
    doc.text("Website  : www.sehatraj.com", { align: "center" });

    doc.moveDown(1);
    doc.fontSize(9).fillColor("gray").text(
      "Powered by SehatRaj Healthcare Platform",
      { align: "center" }
    );

    // End stream
    doc.end();
  } catch (error) {
    console.error("Download Ticket Error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
};

module.exports = {
  getTicket,
  downloadTicket,
};
