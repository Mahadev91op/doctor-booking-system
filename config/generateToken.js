const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || "sehatraj_jwt_secret_dev_key_2026",
    {
      expiresIn: "7d",
    }
  );
};

module.exports = generateToken;
