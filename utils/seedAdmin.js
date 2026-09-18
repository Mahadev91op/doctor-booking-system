const bcrypt = require("bcryptjs");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("adminPassword123", salt);

      await User.create({
        name: "System Admin",
        mobile: "9999999999",
        email: "admin@sehatraj.com",
        password: hashedPassword,
        role: "admin",
      });

      console.log("[Admin Seeder] Default admin account created: admin@sehatraj.com / adminPassword123");
    }
  } catch (error) {
    console.error("[Admin Seeder Error]:", error.message);
  }
};

module.exports = seedAdmin;
