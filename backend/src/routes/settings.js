import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), (req, res) => {
  res.json({
    clientUrl: config.clientUrl,
    adminEmail: config.adminEmail ? `${config.adminEmail.slice(0, 3)}***@***` : null,
    razorpayConfigured: !!(config.razorpay?.keyId && config.razorpay?.keySecret),
    smtpConfigured: !!(config.email?.host && config.email?.user)
  });
});

export default router;
