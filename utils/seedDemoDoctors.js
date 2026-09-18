const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/User");
const Doctor = require("../models/Doctor");

const demoDoctors = [
  {
    name: "Dr. Priya Patel",
    email: "priya.patel@sehatraj.com",
    mobile: "9800000001",
    specialization: "Dermatologist",
    qualification: "MBBS, MD (Dermatology)",
    experience: 8,
    clinicName: "Skin Vitality Clinic",
    clinicAddress: "12th Main, Indiranagar, Bengaluru",
    consultationFee: 700,
    premiumFee: 1200,
    homeVisitFee: 2000,
    payoutAccountId: "acc_priya_dermat_01",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    clinicStartTime: "10:00",
    clinicEndTime: "18:00",
  },
  {
    name: "Dr. Amitav Banerjee",
    email: "amitav.banerjee@sehatraj.com",
    mobile: "9800000002",
    specialization: "Neurologist",
    qualification: "MBBS, DM (Neurology), AIIMS",
    experience: 15,
    clinicName: "Neuro Care Institute",
    clinicAddress: "Sector 1, Salt Lake, Kolkata",
    consultationFee: 1000,
    premiumFee: 1800,
    homeVisitFee: 2500,
    payoutAccountId: "acc_amitav_neuro_02",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    clinicStartTime: "09:00",
    clinicEndTime: "17:00",
  },
  {
    name: "Dr. Sneha Kulkarni",
    email: "sneha.kulkarni@sehatraj.com",
    mobile: "9800000003",
    specialization: "Pediatrician",
    qualification: "MBBS, DCH, DNB (Pediatrics)",
    experience: 10,
    clinicName: "Little Angels Child Clinic",
    clinicAddress: "Paud Road, Kothrud, Pune",
    consultationFee: 500,
    premiumFee: 900,
    homeVisitFee: 1500,
    payoutAccountId: "acc_sneha_pedia_03",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    clinicStartTime: "09:30",
    clinicEndTime: "18:30",
  },
  {
    name: "Dr. Vikramaditya Rathore",
    email: "vikram.rathore@sehatraj.com",
    mobile: "9800000004",
    specialization: "Orthopedic",
    qualification: "MBBS, MS (Orthopedics), MCh",
    experience: 14,
    clinicName: "Joint & Spine Wellness Clinic",
    clinicAddress: "Prithviraj Road, C-Scheme, Jaipur",
    consultationFee: 800,
    premiumFee: 1500,
    homeVisitFee: 2200,
    payoutAccountId: "acc_vikram_ortho_04",
    workingDays: ["Monday", "Wednesday", "Friday", "Saturday"],
    clinicStartTime: "10:00",
    clinicEndTime: "19:00",
  },
  {
    name: "Dr. Ananya Iyer",
    email: "ananya.iyer@sehatraj.com",
    mobile: "9800000005",
    specialization: "Gynecologist",
    qualification: "MBBS, MS (OBG), FICOG",
    experience: 11,
    clinicName: "Matritva Women Care",
    clinicAddress: "G.N. Chetty Road, T. Nagar, Chennai",
    consultationFee: 650,
    premiumFee: 1200,
    homeVisitFee: 1800,
    payoutAccountId: "acc_ananya_gynec_05",
    workingDays: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
    clinicStartTime: "09:00",
    clinicEndTime: "16:00",
  },
  {
    name: "Dr. Farhan Qureshi",
    email: "farhan.qureshi@sehatraj.com",
    mobile: "9800000006",
    specialization: "General Physician",
    qualification: "MBBS, MD (General Medicine)",
    experience: 9,
    clinicName: "City Health PolyClinic",
    clinicAddress: "Shahnajaf Road, Hazratganj, Lucknow",
    consultationFee: 400,
    premiumFee: 800,
    homeVisitFee: 1200,
    payoutAccountId: "acc_farhan_genmed_06",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    clinicStartTime: "08:30",
    clinicEndTime: "17:30",
  },
  {
    name: "Dr. Meenakshi Sundaram",
    email: "meenakshi.s@sehatraj.com",
    mobile: "9800000007",
    specialization: "Ophthalmologist",
    qualification: "MBBS, MS (Ophthalmology), FICO",
    experience: 13,
    clinicName: "Drishti Eye Care Centre",
    clinicAddress: "Road No. 12, Banjara Hills, Hyderabad",
    consultationFee: 600,
    premiumFee: 1100,
    homeVisitFee: 1600,
    payoutAccountId: "acc_meenakshi_eye_07",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    clinicStartTime: "10:00",
    clinicEndTime: "18:00",
  },
  {
    name: "Dr. Rohan Verma",
    email: "rohan.verma@sehatraj.com",
    mobile: "9800000008",
    specialization: "Psychiatrist",
    qualification: "MBBS, MD (Psychiatry)",
    experience: 7,
    clinicName: "MindBridge Mental Health",
    clinicAddress: "Part 1, South Extension, New Delhi",
    consultationFee: 1200,
    premiumFee: 2000,
    homeVisitFee: 3000,
    payoutAccountId: "acc_rohan_psych_08",
    workingDays: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    clinicStartTime: "11:00",
    clinicEndTime: "19:00",
  },
  {
    name: "Dr. Kavita Deshmukh",
    email: "kavita.deshmukh@sehatraj.com",
    mobile: "9800000009",
    specialization: "ENT Specialist",
    qualification: "MBBS, MS (ENT), DLO",
    experience: 12,
    clinicName: "Swara ENT & Hearing Centre",
    clinicAddress: "Ranade Road, Dadar West, Mumbai",
    consultationFee: 550,
    premiumFee: 1000,
    homeVisitFee: 1700,
    payoutAccountId: "acc_kavita_ent_09",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Friday", "Saturday"],
    clinicStartTime: "09:00",
    clinicEndTime: "17:00",
  },
  {
    name: "Dr. Arjun Nambiar",
    email: "arjun.nambiar@sehatraj.com",
    mobile: "9800000010",
    specialization: "Gastroenterologist",
    qualification: "MBBS, MD, DM (Gastroenterology)",
    experience: 16,
    clinicName: "Digestive Health & Endoscopy Centre",
    clinicAddress: "Main Avenue, Panampilly Nagar, Kochi",
    consultationFee: 900,
    premiumFee: 1600,
    homeVisitFee: 2400,
    payoutAccountId: "acc_arjun_gastro_10",
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    clinicStartTime: "09:30",
    clinicEndTime: "17:30",
  },
];

async function seedDemoDoctors() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/doctor-booking-system";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for seeding demo doctors...");

    const hashedPassword = await bcrypt.hash("doctor123", 10);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let createdCount = 0;
    let updatedCount = 0;

    for (const docData of demoDoctors) {
      // 1. Find or create user
      let user = await User.findOne({
        $or: [{ email: docData.email }, { mobile: docData.mobile }],
      });

      if (!user) {
        user = await User.create({
          name: docData.name,
          email: docData.email,
          mobile: docData.mobile,
          password: hashedPassword,
          role: "doctor",
        });
        createdCount++;
      } else {
        user.role = "doctor";
        await user.save();
      }

      // 2. Find or create doctor profile
      let doctor = await Doctor.findOne({ userId: user._id });

      const doctorPayload = {
        userId: user._id,
        name: docData.name,
        specialization: docData.specialization,
        qualification: docData.qualification,
        experience: docData.experience,
        clinicName: docData.clinicName,
        clinicAddress: docData.clinicAddress,
        consultationFee: docData.consultationFee,
        premiumFee: docData.premiumFee,
        premiumBookingEnabled: true,
        homeVisitFee: docData.homeVisitFee,
        homeVisitAvailable: true,
        slotDuration: 20,
        payoutAccountId: docData.payoutAccountId,
        payoutAccountStatus: "active",
        trialStartDate: now,
        trialEndDate: trialEnd,
        billingCycle: "monthly",
        subscriptionStatus: "trial",
        subscriptionPlan: "trial",
        subscriptionStartDate: now,
        subscriptionExpiryDate: trialEnd,
        workingDays: docData.workingDays,
        clinicStartTime: docData.clinicStartTime,
        clinicEndTime: docData.clinicEndTime,
        lunchStart: "13:00",
        lunchEnd: "14:00",
        maxNormalAppointments: 40,
        maxPremiumAppointments: 15,
        maxHomeVisits: 5,
        vacationMode: false,
      };

      if (!doctor) {
        await Doctor.create(doctorPayload);
      } else {
        Object.assign(doctor, doctorPayload);
        await doctor.save();
        updatedCount++;
      }
    }

    console.log(`✅ Seeding complete: ${createdCount} users created, ${demoDoctors.length} doctors verified/seeded.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDemoDoctors();
}

module.exports = seedDemoDoctors;
