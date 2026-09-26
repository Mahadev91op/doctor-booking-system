const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const DailyCounter = require("../models/DailyCounter");

async function seedCompleteDemoData() {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/doctor_booking";
    console.log("Connecting to MongoDB at:", mongoUri);
    await mongoose.connect(mongoUri);

    console.log("--- Purging Old Data ---");
    await Appointment.deleteMany({});
    await DailyCounter.deleteMany({});
    await Doctor.deleteMany({});
    await User.deleteMany({});
    console.log("Cleared User, Doctor, Appointment, DailyCounter collections.");

    // Passwords
    const adminPasswordHash = await bcrypt.hash("Admin@123456", 10);
    const doctorPasswordHash = await bcrypt.hash("Doctor@123456", 10);
    const patientPasswordHash = await bcrypt.hash("Patient@123456", 10);

    // 1. SEED ADMIN
    console.log("--- Seeding Admin Account ---");
    const adminUser = await User.create({
      name: "System Admin",
      mobile: "9999999999",
      email: "admin@sehatraj.com",
      password: adminPasswordHash,
      role: "admin",
    });
    console.log("Admin seeded: admin@sehatraj.com / Admin@123456");

    // 2. SEED DOCTORS
    console.log("--- Seeding 10 Verified Specialists in Rajouri ---");
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days active

    const doctorsData = [
      {
        name: "Dr. Rajesh Sharma",
        email: "rajesh.cardio@sehatraj.com",
        mobile: "9812345670",
        specialization: "Cardiologist",
        qualification: "MBBS, MD, DM (Cardiology)",
        experience: 15,
        clinicName: "Apex Heart & Cardiac Care Centre",
        clinicAddress: "Main Market, Near Gujjar Mandi, Rajouri, J&K",
        consultationFee: 600,
        premiumFee: 1000,
        homeVisitFee: 1800,
        payoutAccountId: "acc_rajesh_cardio_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "09:00",
        clinicEndTime: "17:00",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 30,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        premiumStartTime: "17:00",
        premiumEndTime: "19:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Wednesday", "Friday"],
        homeVisitStartTime: "19:00",
        homeVisitEndTime: "21:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 4,
      },
      {
        name: "Dr. Priya Patel",
        email: "priya.derma@sehatraj.com",
        mobile: "9812345671",
        specialization: "Dermatologist",
        qualification: "MBBS, MD (Dermatology & Venereology)",
        experience: 9,
        clinicName: "Glow Skin & Laser Clinic",
        clinicAddress: "Jawahar Nagar, Ward No. 5, Rajouri, J&K",
        consultationFee: 500,
        premiumFee: 900,
        homeVisitFee: 1500,
        payoutAccountId: "acc_priya_derma_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "10:00",
        clinicEndTime: "18:00",
        lunchStart: "13:30",
        lunchEnd: "14:30",
        slotDuration: 15,
        maxNormalAppointments: 25,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "18:00",
        premiumEndTime: "20:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Tuesday", "Thursday", "Saturday"],
        homeVisitStartTime: "18:00",
        homeVisitEndTime: "20:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 4,
      },
      {
        name: "Dr. Amitav Banerjee",
        email: "amitav.neuro@sehatraj.com",
        mobile: "9812345672",
        specialization: "Neurologist",
        qualification: "MBBS, DM (Neurology), AIIMS",
        experience: 16,
        clinicName: "Neuro Life Institute & Brain Care",
        clinicAddress: "Opposite District Hospital, Rajouri, J&K",
        consultationFee: 800,
        premiumFee: 1400,
        homeVisitFee: 2500,
        payoutAccountId: "acc_amitav_neuro_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "yearly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        clinicStartTime: "09:00",
        clinicEndTime: "17:00",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 20,
        maxNormalAppointments: 20,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "17:00",
        premiumEndTime: "19:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Wednesday", "Friday"],
        homeVisitStartTime: "19:00",
        homeVisitEndTime: "21:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
      {
        name: "Dr. Sneha Kulkarni",
        email: "sneha.pedia@sehatraj.com",
        mobile: "9812345673",
        specialization: "Pediatrician",
        qualification: "MBBS, DCH, DNB (Pediatrics)",
        experience: 11,
        clinicName: "Little Angels Children Hospital",
        clinicAddress: "Kheora Ward No. 8, Rajouri, J&K",
        consultationFee: 400,
        premiumFee: 750,
        homeVisitFee: 1400,
        payoutAccountId: "acc_sneha_pedia_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "quarterly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "09:30",
        clinicEndTime: "17:30",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 30,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        premiumStartTime: "17:30",
        premiumEndTime: "19:30",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Wednesday", "Saturday"],
        homeVisitStartTime: "19:30",
        homeVisitEndTime: "21:30",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 4,
      },
      {
        name: "Dr. Vikramaditya Rathore",
        email: "vikram.ortho@sehatraj.com",
        mobile: "9812345674",
        specialization: "Orthopedic",
        qualification: "MBBS, MS (Orthopedics), Joint Replacement Specialist",
        experience: 14,
        clinicName: "Rajouri Bone & Joint Clinic",
        clinicAddress: "Old Bus Stand, Rajouri, J&K",
        consultationFee: 700,
        premiumFee: 1200,
        homeVisitFee: 2000,
        payoutAccountId: "acc_vikram_ortho_rajouri",
        subscriptionStatus: "trial",
        subscriptionPlan: "trial",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "10:00",
        clinicEndTime: "18:00",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 20,
        maxNormalAppointments: 25,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Thursday", "Saturday"],
        premiumStartTime: "18:00",
        premiumEndTime: "20:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Wednesday", "Friday"],
        homeVisitStartTime: "18:00",
        homeVisitEndTime: "20:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
      {
        name: "Dr. Ananya Iyer",
        email: "ananya.gynec@sehatraj.com",
        mobile: "9812345675",
        specialization: "Gynecologist",
        qualification: "MBBS, MS (OBG), FICOG",
        experience: 12,
        clinicName: "Matritva Women's Health Clinic",
        clinicAddress: "Panja Chowk, Rajouri, J&K",
        consultationFee: 600,
        premiumFee: 1100,
        homeVisitFee: 1800,
        payoutAccountId: "acc_ananya_gynec_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "09:00",
        clinicEndTime: "16:30",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 25,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "16:30",
        premiumEndTime: "18:30",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Tuesday", "Thursday", "Sunday"],
        homeVisitStartTime: "16:30",
        homeVisitEndTime: "18:30",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
      {
        name: "Dr. Farhan Qureshi",
        email: "farhan.genmed@sehatraj.com",
        mobile: "9812345676",
        specialization: "General Physician",
        qualification: "MBBS, MD (General Medicine)",
        experience: 10,
        clinicName: "City Medicare Family Clinic",
        clinicAddress: "Abdullah Bridge Road, Bela Colony, Rajouri, J&K",
        consultationFee: 350,
        premiumFee: 700,
        homeVisitFee: 1200,
        payoutAccountId: "acc_farhan_genmed_rajouri",
        subscriptionStatus: "trial",
        subscriptionPlan: "trial",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "08:30",
        clinicEndTime: "17:00",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 35,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        premiumStartTime: "17:00",
        premiumEndTime: "19:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Wednesday", "Friday", "Sunday"],
        homeVisitStartTime: "19:00",
        homeVisitEndTime: "21:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 4,
      },
      {
        name: "Dr. Meenakshi Sundaram",
        email: "meenakshi.eye@sehatraj.com",
        mobile: "9812345677",
        specialization: "Ophthalmologist",
        qualification: "MBBS, MS (Ophthalmology), FICO",
        experience: 13,
        clinicName: "Drishti Eye & Laser Centre",
        clinicAddress: "Salani Bridge Road, Rajouri, J&K",
        consultationFee: 500,
        premiumFee: 950,
        homeVisitFee: 1600,
        payoutAccountId: "acc_meenakshi_eye_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        clinicStartTime: "09:30",
        clinicEndTime: "17:30",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 25,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "17:30",
        premiumEndTime: "19:30",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Thursday"],
        homeVisitStartTime: "17:30",
        homeVisitEndTime: "19:30",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
      {
        name: "Dr. Kavita Deshmukh",
        email: "kavita.ent@sehatraj.com",
        mobile: "9812345678",
        specialization: "ENT Specialist",
        qualification: "MBBS, MS (ENT), DLO",
        experience: 12,
        clinicName: "Swara ENT & Hearing Care",
        clinicAddress: "Tariq College Road, Rajouri, J&K",
        consultationFee: 450,
        premiumFee: 850,
        homeVisitFee: 1500,
        payoutAccountId: "acc_kavita_ent_rajouri",
        subscriptionStatus: "trial",
        subscriptionPlan: "trial",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        clinicStartTime: "09:00",
        clinicEndTime: "16:30",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 15,
        maxNormalAppointments: 25,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "16:30",
        premiumEndTime: "18:30",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Tuesday", "Friday"],
        homeVisitStartTime: "16:30",
        homeVisitEndTime: "18:30",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
      {
        name: "Dr. Arjun Nambiar",
        email: "arjun.gastro@sehatraj.com",
        mobile: "9812345679",
        specialization: "Gastroenterologist",
        qualification: "MBBS, MD, DM (Gastroenterology)",
        experience: 17,
        clinicName: "Digestive Care & Liver Clinic",
        clinicAddress: "Airport Road, Near Circuit House, Rajouri, J&K",
        consultationFee: 850,
        premiumFee: 1500,
        homeVisitFee: 2400,
        payoutAccountId: "acc_arjun_gastro_rajouri",
        subscriptionStatus: "active",
        subscriptionPlan: "yearly",
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        clinicStartTime: "09:00",
        clinicEndTime: "17:00",
        lunchStart: "13:00",
        lunchEnd: "14:00",
        slotDuration: 20,
        maxNormalAppointments: 20,
        premiumBookingEnabled: true,
        premiumWorkingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        premiumStartTime: "17:00",
        premiumEndTime: "19:00",
        premiumSlotDuration: 20,
        maxPremiumAppointments: 6,
        homeVisitAvailable: true,
        homeVisitWorkingDays: ["Monday", "Wednesday", "Friday"],
        homeVisitStartTime: "19:00",
        homeVisitEndTime: "21:00",
        homeVisitSlotDuration: 30,
        maxHomeVisits: 3,
      },
    ];

    const createdDoctors = [];
    for (const d of doctorsData) {
      const user = await User.create({
        name: d.name,
        email: d.email,
        mobile: d.mobile,
        password: doctorPasswordHash,
        role: "doctor",
      });

      const doctor = await Doctor.create({
        userId: user._id,
        name: d.name,
        specialization: d.specialization,
        qualification: d.qualification,
        experience: d.experience,
        clinicName: d.clinicName,
        clinicAddress: d.clinicAddress,
        consultationFee: d.consultationFee,
        premiumFee: d.premiumFee,
        premiumBookingEnabled: d.premiumBookingEnabled,
        premiumWorkingDays: d.premiumWorkingDays,
        premiumStartTime: d.premiumStartTime,
        premiumEndTime: d.premiumEndTime,
        premiumSlotDuration: d.premiumSlotDuration,
        maxPremiumAppointments: d.maxPremiumAppointments,
        homeVisitFee: d.homeVisitFee,
        homeVisitAvailable: d.homeVisitAvailable,
        homeVisitWorkingDays: d.homeVisitWorkingDays,
        homeVisitStartTime: d.homeVisitStartTime,
        homeVisitEndTime: d.homeVisitEndTime,
        homeVisitSlotDuration: d.homeVisitSlotDuration,
        maxHomeVisits: d.maxHomeVisits,
        slotDuration: d.slotDuration,
        payoutAccountId: d.payoutAccountId,
        payoutAccountStatus: "active",
        subscriptionStatus: d.subscriptionStatus,
        subscriptionPlan: d.subscriptionPlan,
        subscriptionStartDate: now,
        subscriptionExpiryDate: expiryDate,
        trialStartDate: now,
        trialEndDate: expiryDate,
        billingCycle: "monthly",
        workingDays: d.workingDays,
        clinicStartTime: d.clinicStartTime,
        clinicEndTime: d.clinicEndTime,
        lunchStart: d.lunchStart,
        lunchEnd: d.lunchEnd,
        maxNormalAppointments: d.maxNormalAppointments,
        vacationMode: false,
      });

      createdDoctors.push(doctor);
    }
    console.log(`Seeded ${createdDoctors.length} doctors successfully.`);

    // 3. SEED PATIENTS
    console.log("--- Seeding 6 Realistic Patients ---");
    const patientsData = [
      { name: "Aarav Mehta", email: "aarav.mehta@sehatraj.com", mobile: "9876543210" },
      { name: "Sunita Devi", email: "sunita.devi@sehatraj.com", mobile: "9876543211" },
      { name: "Mohammad Tariq", email: "mohammad.tariq@sehatraj.com", mobile: "9876543212" },
      { name: "Pooja Sharma", email: "pooja.sharma@sehatraj.com", mobile: "9876543213" },
      { name: "Gurpreet Singh", email: "gurpreet.singh@sehatraj.com", mobile: "9876543214" },
      { name: "Zahoor Ahmed", email: "zahoor.ahmed@sehatraj.com", mobile: "9876543215" },
    ];

    const createdPatients = [];
    for (const p of patientsData) {
      const patient = await User.create({
        name: p.name,
        email: p.email,
        mobile: p.mobile,
        password: patientPasswordHash,
        role: "patient",
      });
      createdPatients.push(patient);
    }
    console.log(`Seeded ${createdPatients.length} patients successfully.`);

    // 4. SEED APPOINTMENTS
    console.log("--- Seeding 25 Realistic Appointments across normal, premium, and home visits ---");

    const todayStr = now.toISOString().split("T")[0];
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const appointmentsToCreate = [
      // 1-5: Completed past normal appointments
      {
        patientId: createdPatients[0]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: fiveDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].consultationFee,
        amountPaid: createdDoctors[0].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_rajesh_001",
        orderId: "order_demo_rajesh_001",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "01",
      },
      {
        patientId: createdPatients[1]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "normal",
        tokenNumber: 2,
        appointmentDate: fiveDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].consultationFee,
        amountPaid: createdDoctors[0].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_rajesh_002",
        orderId: "order_demo_rajesh_002",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "02",
      },
      {
        patientId: createdPatients[2]._id,
        doctorId: createdDoctors[1]._id, // Dr. Priya Patel
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: threeDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[1].consultationFee,
        amountPaid: createdDoctors[1].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_priya_001",
        orderId: "order_demo_priya_001",
        payoutAccountId: createdDoctors[1].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "03",
      },
      {
        patientId: createdPatients[3]._id,
        doctorId: createdDoctors[2]._id, // Dr. Amitav Banerjee
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: twoDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[2].consultationFee,
        amountPaid: createdDoctors[2].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_amitav_001",
        orderId: "order_demo_amitav_001",
        payoutAccountId: createdDoctors[2].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "04",
      },
      {
        patientId: createdPatients[4]._id,
        doctorId: createdDoctors[3]._id, // Dr. Sneha Kulkarni
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: yesterday,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[3].consultationFee,
        amountPaid: createdDoctors[3].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_sneha_001",
        orderId: "order_demo_sneha_001",
        payoutAccountId: createdDoctors[3].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "05",
      },

      // 6-10: Completed past premium & home appointments
      {
        patientId: createdPatients[5]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "premium",
        slotDate: threeDaysAgo,
        slotTime: "17:00",
        appointmentDate: threeDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].premiumFee,
        amountPaid: createdDoctors[0].premiumFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_rajesh_prem_01",
        orderId: "order_demo_rajesh_prem_01",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "06",
      },
      {
        patientId: createdPatients[0]._id,
        doctorId: createdDoctors[4]._id, // Dr. Vikramaditya Rathore
        appointmentType: "premium",
        slotDate: twoDaysAgo,
        slotTime: "18:00",
        appointmentDate: twoDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[4].premiumFee,
        amountPaid: createdDoctors[4].premiumFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_vikram_prem_01",
        orderId: "order_demo_vikram_prem_01",
        payoutAccountId: createdDoctors[4].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "07",
      },
      {
        patientId: createdPatients[1]._id,
        doctorId: createdDoctors[5]._id, // Dr. Ananya Iyer
        appointmentType: "home",
        slotTime: "16:30",
        appointmentDate: twoDaysAgo,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[5].homeVisitFee,
        amountPaid: createdDoctors[5].homeVisitFee,
        homeVisitAddress: "Ward No. 3, Near Old City Gate, Rajouri",
        homeVisitLandmark: "Opposite High School",
        homeVisitCity: "Rajouri",
        homeVisitPincode: "185131",
        doctorResponse: "accepted",
        paymentMethod: "razorpay",
        paymentId: "pay_demo_ananya_home_01",
        orderId: "order_demo_ananya_home_01",
        payoutAccountId: createdDoctors[5].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "08",
      },
      {
        patientId: createdPatients[2]._id,
        doctorId: createdDoctors[6]._id, // Dr. Farhan Qureshi
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: yesterday,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[6].consultationFee,
        amountPaid: createdDoctors[6].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_farhan_001",
        orderId: "order_demo_farhan_001",
        payoutAccountId: createdDoctors[6].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "09",
      },
      {
        patientId: createdPatients[3]._id,
        doctorId: createdDoctors[7]._id, // Dr. Meenakshi Sundaram
        appointmentType: "premium",
        slotDate: yesterday,
        slotTime: "17:30",
        appointmentDate: yesterday,
        status: "completed",
        paymentStatus: "paid",
        amountDue: createdDoctors[7].premiumFee,
        amountPaid: createdDoctors[7].premiumFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_meenakshi_001",
        orderId: "order_demo_meenakshi_001",
        payoutAccountId: createdDoctors[7].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "10",
      },

      // 11-18: TODAY'S APPOINTMENTS (Checked / Confirmed)
      {
        patientId: createdPatients[4]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "checked",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].consultationFee,
        amountPaid: createdDoctors[0].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_rajesh_01",
        orderId: "order_demo_today_rajesh_01",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "11",
      },
      {
        patientId: createdPatients[5]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "normal",
        tokenNumber: 2,
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].consultationFee,
        amountPaid: createdDoctors[0].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_rajesh_02",
        orderId: "order_demo_today_rajesh_02",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "12",
      },
      {
        patientId: createdPatients[0]._id,
        doctorId: createdDoctors[1]._id, // Dr. Priya Patel
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "checked",
        paymentStatus: "paid",
        amountDue: createdDoctors[1].consultationFee,
        amountPaid: createdDoctors[1].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_priya_01",
        orderId: "order_demo_today_priya_01",
        payoutAccountId: createdDoctors[1].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "13",
      },
      {
        patientId: createdPatients[1]._id,
        doctorId: createdDoctors[2]._id, // Dr. Amitav Banerjee
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[2].consultationFee,
        amountPaid: createdDoctors[2].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_amitav_01",
        orderId: "order_demo_today_amitav_01",
        payoutAccountId: createdDoctors[2].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "14",
      },
      {
        patientId: createdPatients[2]._id,
        doctorId: createdDoctors[3]._id, // Dr. Sneha Kulkarni
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[3].consultationFee,
        amountPaid: createdDoctors[3].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_sneha_01",
        orderId: "order_demo_today_sneha_01",
        payoutAccountId: createdDoctors[3].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "15",
      },
      {
        patientId: createdPatients[3]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "premium",
        slotDate: now,
        slotTime: "17:00",
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].premiumFee,
        amountPaid: createdDoctors[0].premiumFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_rajesh_prem",
        orderId: "order_demo_today_rajesh_prem",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "16",
      },
      {
        patientId: createdPatients[4]._id,
        doctorId: createdDoctors[6]._id, // Dr. Farhan Qureshi
        appointmentType: "home",
        slotTime: "19:00",
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[6].homeVisitFee,
        amountPaid: createdDoctors[6].homeVisitFee,
        homeVisitAddress: "Mohalla Jawahar Nagar, Near Masjid, Rajouri",
        homeVisitLandmark: "Main Water Tank",
        homeVisitCity: "Rajouri",
        homeVisitPincode: "185131",
        doctorResponse: "accepted",
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_farhan_home",
        orderId: "order_demo_today_farhan_home",
        payoutAccountId: createdDoctors[6].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "17",
      },
      {
        patientId: createdPatients[5]._id,
        doctorId: createdDoctors[9]._id, // Dr. Arjun Nambiar
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[9].consultationFee,
        amountPaid: createdDoctors[9].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_today_arjun_01",
        orderId: "order_demo_today_arjun_01",
        payoutAccountId: createdDoctors[9].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "18",
      },

      // 19-21: Pending Payment bookings for today
      {
        patientId: createdPatients[0]._id,
        doctorId: createdDoctors[4]._id, // Dr. Vikramaditya
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: now,
        status: "pending_payment",
        paymentStatus: "pending",
        amountDue: createdDoctors[4].consultationFee,
        amountPaid: 0,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "19",
      },
      {
        patientId: createdPatients[1]._id,
        doctorId: createdDoctors[8]._id, // Dr. Kavita Deshmukh
        appointmentType: "premium",
        slotDate: now,
        slotTime: "16:30",
        appointmentDate: now,
        status: "pending_payment",
        paymentStatus: "pending",
        amountDue: createdDoctors[8].premiumFee,
        amountPaid: 0,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "20",
      },

      // 22-25: Future Appointments (Tomorrow)
      {
        patientId: createdPatients[2]._id,
        doctorId: createdDoctors[0]._id, // Dr. Rajesh Sharma
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: tomorrow,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[0].consultationFee,
        amountPaid: createdDoctors[0].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_tmrw_rajesh_01",
        orderId: "order_demo_tmrw_rajesh_01",
        payoutAccountId: createdDoctors[0].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "21",
      },
      {
        patientId: createdPatients[3]._id,
        doctorId: createdDoctors[1]._id, // Dr. Priya Patel
        appointmentType: "premium",
        slotDate: tomorrow,
        slotTime: "18:00",
        appointmentDate: tomorrow,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[1].premiumFee,
        amountPaid: createdDoctors[1].premiumFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_tmrw_priya_01",
        orderId: "order_demo_tmrw_priya_01",
        payoutAccountId: createdDoctors[1].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "22",
      },
      {
        patientId: createdPatients[4]._id,
        doctorId: createdDoctors[5]._id, // Dr. Ananya Iyer
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: tomorrow,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[5].consultationFee,
        amountPaid: createdDoctors[5].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_tmrw_ananya_01",
        orderId: "order_demo_tmrw_ananya_01",
        payoutAccountId: createdDoctors[5].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "23",
      },
      {
        patientId: createdPatients[5]._id,
        doctorId: createdDoctors[7]._id, // Dr. Meenakshi Sundaram
        appointmentType: "normal",
        tokenNumber: 1,
        appointmentDate: tomorrow,
        status: "confirmed",
        paymentStatus: "paid",
        amountDue: createdDoctors[7].consultationFee,
        amountPaid: createdDoctors[7].consultationFee,
        paymentMethod: "razorpay",
        paymentId: "pay_demo_tmrw_meenakshi_01",
        orderId: "order_demo_tmrw_meenakshi_01",
        payoutAccountId: createdDoctors[7].payoutAccountId,
        bookingReference: "SR" + Date.now().toString().slice(-6) + "24",
      },
    ];

    const createdAppointments = await Appointment.insertMany(appointmentsToCreate);
    console.log(`Seeded ${createdAppointments.length} appointments.`);

    // 5. SEED DAILY COUNTERS FOR TODAY
    console.log("--- Seeding DailyCounter records for today's tokens ---");
    // Dr. Rajesh Sharma has token 2 today
    await DailyCounter.create({
      _id: `${createdDoctors[0]._id}_${todayStr}`,
      count: 2,
    });
    // Dr. Priya Patel has token 1 today
    await DailyCounter.create({
      _id: `${createdDoctors[1]._id}_${todayStr}`,
      count: 1,
    });
    // Dr. Amitav Banerjee has token 1 today
    await DailyCounter.create({
      _id: `${createdDoctors[2]._id}_${todayStr}`,
      count: 1,
    });
    // Dr. Sneha Kulkarni has token 1 today
    await DailyCounter.create({
      _id: `${createdDoctors[3]._id}_${todayStr}`,
      count: 1,
    });
    // Dr. Arjun Nambiar has token 1 today
    await DailyCounter.create({
      _id: `${createdDoctors[9]._id}_${todayStr}`,
      count: 1,
    });
    console.log("Daily counters initialized.");

    // Summary calculation
    const totalRev = createdAppointments
      .filter((a) => a.paymentStatus === "paid")
      .reduce((sum, a) => sum + (a.amountPaid || a.amountDue || 0), 0);

    console.log("==================================================");
    console.log("🎉 SEEDING COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
    console.log(`- Admin Account: admin@sehatraj.com / Admin@123456 (Mobile: 9999999999)`);
    console.log(`- Total Doctors: ${createdDoctors.length} (7 Active, 3 Trial)`);
    console.log(`- Doctor Login: Any email (e.g. rajesh.cardio@sehatraj.com) / Doctor@123456`);
    console.log(`- Total Patients: ${createdPatients.length}`);
    console.log(`- Patient Login: Any email/mobile (e.g. aarav.mehta@sehatraj.com or 9876543210) / Patient@123456`);
    console.log(`- Total Appointments: ${createdAppointments.length}`);
    console.log(`- Platform Paid Revenue: ₹${totalRev}`);
    console.log("==================================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed with error:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedCompleteDemoData();
}

module.exports = seedCompleteDemoData;
