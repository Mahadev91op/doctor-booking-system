const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "patient",
    },
    resetOTP: {
      type: String,
    },

    resetOTPExpire: {
      type: Date,
    },

    resetOTPVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetOTP;
        delete ret.resetOTPExpire;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.resetOTP;
        delete ret.resetOTPExpire;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("User", userSchema);
