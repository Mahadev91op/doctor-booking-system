const Razorpay = require("razorpay");

let razorpayInstance = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn(
    "⚠️ WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in .env. Razorpay initialized in safe fallback mode."
  );
  razorpayInstance = new Proxy({}, {
    get(target, prop) {
      return new Proxy({}, {
        get(subTarget, subProp) {
          return async () => {
            throw new Error(
              `Razorpay ${prop}.${subProp} call failed: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in .env to process transactions.`
            );
          };
        }
      });
    }
  });
}

module.exports = razorpayInstance;

