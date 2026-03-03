/**
 * Test Razorpay API keys from .env
 * Run: node scripts/test-razorpay.js
 * Or with custom keys: node scripts/test-razorpay.js <KEY_ID> <KEY_SECRET>
 */
import "dotenv/config";

function sanitize(val) {
  if (val == null || val === "") return undefined;
  return String(val).trim().replace(/^["']|["']$/g, "");
}

const keyId = process.argv[2] || sanitize(process.env.RAZORPAY_KEY_ID);
const keySecret = process.argv[3] || sanitize(process.env.RAZORPAY_KEY_SECRET);

if (!keyId || !keySecret) {
  console.error("Missing keys. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
  process.exit(1);
}

console.log("Key ID:", keyId);
console.log("Key Secret length:", keySecret.length, "(hidden)");
console.log("Testing Razorpay API...\n");

const auth = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");
const res = await fetch("https://api.razorpay.com/v1/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Basic ${auth}`
  },
  body: JSON.stringify({
    amount: 100,
    currency: "INR",
    receipt: "test_" + Date.now()
  })
});

const data = await res.json();

if (res.ok) {
  console.log("SUCCESS! Razorpay keys are valid.");
  console.log("Order ID:", data.id);
} else {
  console.error("FAILED:", data.error?.description || data.error?.code || JSON.stringify(data));
  console.error("\nCommon causes:");
  console.error("- Key ID and Key Secret must be from the same Razorpay account");
  console.error("- Get keys from: https://dashboard.razorpay.com/app/keys");
  console.error("- Remove any extra spaces or quotes in .env");
  process.exit(1);
}
