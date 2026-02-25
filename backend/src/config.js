import dotenv from "dotenv";

dotenv.config({ override: true });

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lmspro",
  jwtSecret: process.env.JWT_SECRET || "change_this_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminEmail: process.env.ADMIN_EMAIL || "admin@learnhub.com",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123"
};
