import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { sendResetEmail } from "../utils/email.js";

const router = express.Router();

const createToken = (user) => {
  return jwt.sign({ sub: user._id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const alphaRegex = /^[A-Za-z\s]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const nameStr = String(name).trim();
    const emailStr = String(email).trim();
    if (!alphaRegex.test(nameStr) || nameStr.length > 50) {
      return res.status(400).json({ message: "Name must contain only letters and spaces, maximum 50 characters" });
    }
    if (!emailRegex.test(emailStr) || emailStr.length > 50) {
      return res.status(400).json({ message: "Enter a valid email address up to 50 characters" });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    const phoneStr = String(phone).replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phoneStr)) {
      return res.status(400).json({ message: "Phone number must be 10 digits and start with 6-9" });
    }
    const existing = await User.findOne({ email: emailStr.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }
    const user = await User.create({
      name: nameStr,
      email: emailStr.toLowerCase(),
      phone: phoneStr,
      password,
      role,
      authProvider: "local"
    });
    const token = createToken(user);
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      token
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Failed to register user", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const emailStr = String(email).trim();
    if (!emailRegex.test(emailStr)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (emailStr.toLowerCase() === String(config.adminEmail).toLowerCase() && password === config.adminPassword) {
      const adminUser = {
        _id: "admin-static",
        name: "Administrator",
        email: config.adminEmail,
        role: "admin"
      };
      const token = createToken(adminUser);
      return res.json({
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role
        },
        token
      });
    }
    const user = await User.findOne({ email: emailStr.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google sign-in" });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = createToken(user);
    res.json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone || "", role: user.role },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Failed to login", error: error.message });
  }
});

/** Verify Google ID token from Sign in with Google / One Tap, issue LMS JWT */
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ message: "Missing Google credential" });
    }
    if (!config.googleClientId) {
      return res.status(503).json({ message: "Google sign-in is not configured on the server" });
    }

    const client = new OAuth2Client(config.googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).json({ message: "Invalid Google account data" });
    }

    const email = String(payload.email).toLowerCase();
    if (email === String(config.adminEmail).toLowerCase()) {
      return res.status(400).json({
        message: "Administrator accounts must sign in with email and password"
      });
    }

    const googleId = payload.sub;
    const rawName =
      (payload.name && String(payload.name).trim()) ||
      [payload.given_name, payload.family_name].filter(Boolean).join(" ").trim() ||
      email.split("@")[0] ||
      "User";
    const safeName = rawName
      .replace(/[^A-Za-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50) || "User";

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      if (user.googleId && user.googleId !== googleId) {
        return res.status(400).json({ message: "This email is linked to another Google account" });
      }
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      user = await User.create({
        name: safeName,
        email,
        googleId,
        authProvider: "google",
        role: "student"
      });
    }

    const token = createToken(user);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({
      message: "Google sign-in failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security reasons, don't confirm if user exists
      return res.json({ message: "If an account exists, a reset link will be sent" });
    }

    // Generate a secure random token for the reset link
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3600000); // 1 hour expiry

    user.resetToken = resetToken;
    user.resetTokenExpiry = expiry;
    await user.save();

    // Construct reset link
    const resetLink = `${config.clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    let emailSent = true;
    let emailError;
    try {
      await sendResetEmail(user.email, resetLink);
    } catch (err) {
      emailSent = false;
      emailError = err;
      console.error("Failed to send email:", err);
    }

    /**
     * Only NODE_ENV=development gets the optional dev fallback (devLink in JSON + no 500).
     * If NODE_ENV is unset (common on some hosts), treat like production so SMTP must work.
     */
    const isDev = process.env.NODE_ENV === "development";
    if (!emailSent && !isDev) {
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      return res.status(500).json({
        message:
          "Could not send reset email. On the server, set SMTP_USER, SMTP_PASSWORD, and CLIENT_URL (your public site URL, e.g. https://lmspro.speshway.site)."
      });
    }

    const payload = {
      message: emailSent
        ? "If an account exists for that email, a reset link has been sent"
        : "Email could not be sent from this machine. Check the browser console for a dev-only reset URL, or fix SMTP in backend/.env."
    };
    if (isDev) {
      payload.devLink = resetLink;
      if (!emailSent) {
        payload.emailDeliveryFailed = true;
        payload.error = emailError?.message;
      }
    }
    res.json(payload);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process request", error: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    if (req.user._id === "admin-static") {
      return res.status(400).json({ message: "Admin profile cannot be updated via this endpoint" });
    }
    const { name, email, phone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const alphaRegex = /^[A-Za-z\s]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (typeof name === "string" && name.trim()) {
      const n = name.trim();
      if (!alphaRegex.test(n) || n.length > 50) {
        return res.status(400).json({ message: "Invalid name: letters/spaces only, max 50" });
      }
      user.name = n;
    }
    if (typeof email === "string" && email.trim()) {
      const e = email.trim().toLowerCase();
      if (!emailRegex.test(e) || e.length > 50) {
        return res.status(400).json({ message: "Invalid email format or too long" });
      }
      user.email = e;
    }
    if (typeof phone === "string") {
      const phoneStr = phone.replace(/\D/g, "");
      if (phoneStr && !/^[6-9]\d{9}$/.test(phoneStr)) {
        return res.status(400).json({ message: "Phone number must start with 6-9 and be 10 digits" });
      }
      user.phone = phoneStr || undefined;
    }
    await user.save();
    const { password: _, ...safeUser } = user.toObject();
    res.json({ user: { id: safeUser._id, name: safeUser.name, email: safeUser.email, phone: safeUser.phone || "", role: safeUser.role } });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
});

export default router;
