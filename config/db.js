const mongoose = require("mongoose");
const seedAdmin = require("../utils/seedAdmin");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/doctor_booking";
    await mongoose.connect(mongoUri);

    console.log("MongoDB Connected");
    await seedAdmin();
  } catch (error) {
    console.error("Database Connection Error:", error.message);
  }
};

module.exports = connectDB;
