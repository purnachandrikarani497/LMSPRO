import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lmspro",
  jwtSecret: process.env.JWT_SECRET || "change_this_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminEmail: process.env.ADMIN_EMAIL || "admin@learnhub.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  adminPhone: process.env.ADMIN_PHONE || "",
  email: {
    /** Support common alternate names (our older error text mentioned EMAIL_*). */
    host: sanitizeEnv(process.env.SMTP_HOST ?? process.env.EMAIL_HOST),
    port: (() => {
      const p = parseInt(process.env.SMTP_PORT ?? process.env.EMAIL_PORT ?? "", 10);
      return Number.isFinite(p) && p > 0 ? p : 587;
    })(),
    user: sanitizeEnv(process.env.SMTP_USER ?? process.env.EMAIL_USER),
    /** App passwords may be pasted with spaces; Nodemailer needs them removed. */
    pass:
      sanitizeEnv(
        process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? process.env.EMAIL_PASS
      )?.replace(/\s+/g, "") ?? "",
    secure: (process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE) === "true",
    from: sanitizeEnv(
      process.env.FROM_EMAIL ?? process.env.SMTP_FROM ?? process.env.EMAIL_FROM
    )
  },
  s3: {
    region: process.env.AWS_REGION || "ap-south-1",
    bucket: process.env.AWS_S3_BUCKET || "lms-s3-speshway",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  razorpay: {
    keyId: sanitizeEnv(process.env.RAZORPAY_KEY_ID),
    keySecret: sanitizeEnv(process.env.RAZORPAY_KEY_SECRET)
  },
  /** Same Web client ID as the frontend (VITE_GOOGLE_CLIENT_ID). Used to verify Google ID tokens. */
  googleClientId: sanitizeEnv(process.env.GOOGLE_CLIENT_ID)
};

function sanitizeEnv(val) {
  if (val == null || val === "") return undefined;
  return String(val).trim().replace(/^["']|["']$/g, "");
}
