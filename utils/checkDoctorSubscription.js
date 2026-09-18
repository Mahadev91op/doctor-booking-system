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

module.exports = checkDoctorSubscription;
