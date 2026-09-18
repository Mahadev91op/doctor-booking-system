const Doctor = require("../models/Doctor");

const checkDoctorSubscription = async (doctor) => {
  if (!doctor) return null;

  const now = new Date();

  // Check trial expiration
  if (
    doctor.subscriptionStatus === "trial" &&
    ((doctor.trialEndDate && doctor.trialEndDate < now) ||
      (doctor.subscriptionExpiryDate && doctor.subscriptionExpiryDate < now))
  ) {
    doctor.subscriptionStatus = "expired";
    await doctor.save();
    return doctor;
  }

  // Check paid subscription expiration
  if (
    doctor.subscriptionStatus === "active" &&
    doctor.subscriptionExpiryDate &&
    doctor.subscriptionExpiryDate < now
  ) {
    doctor.subscriptionStatus = "expired";
    await doctor.save();
    return doctor;
  }

  return doctor;
};

const checkAllDoctorsSubscription = async () => {
  try {
    const now = new Date();
    const expiredDoctors = await Doctor.find({
      $or: [
        {
          subscriptionStatus: "trial",
          $or: [
            { trialEndDate: { $lt: now } },
            { subscriptionExpiryDate: { $lt: now } },
          ],
        },
        {
          subscriptionStatus: "active",
          subscriptionExpiryDate: { $lt: now },
        },
      ],
    });

    let updatedCount = 0;
    for (const doc of expiredDoctors) {
      doc.subscriptionStatus = "expired";
      await doc.save();
      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`⏰ Automated Check: Expired ${updatedCount} overdue doctor subscriptions/trials.`);
    }
    return updatedCount;
  } catch (err) {
    console.error("❌ Error in checkAllDoctorsSubscription:", err.message);
    return 0;
  }
};

checkDoctorSubscription.checkAllDoctorsSubscription = checkAllDoctorsSubscription;

module.exports = checkDoctorSubscription;

