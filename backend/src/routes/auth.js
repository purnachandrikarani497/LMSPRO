import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
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
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    const phoneStr = String(phone).replace(/\D/g, "");
    if (phoneStr.length !== 10) {
      return res.status(400).json({ message: "Phone number must be exactly 10 digits" });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }
    const user = await User.create({ name, email, phone: phoneStr, password, role });
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
    if (email === config.adminEmail && password === config.adminPassword) {
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
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

    // Send email using nodemailer
    try {
      await sendResetEmail(user.email, resetLink);
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // In production, we must fail if email isn't sent
      if (process.env.NODE_ENV === "production") {
        return res.status(500).json({ message: "Failed to send reset email" });
      }
    }

    res.json({
      message: "If an account exists, a reset link has been sent to your email",
      devLink: process.env.NODE_ENV !== "production" ? resetLink : undefined,
      token: resetToken // Return token for immediate reset in UI
    });
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
    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string" && email.trim()) user.email = email.trim().toLowerCase();
    if (typeof phone === "string") {
      const phoneStr = phone.replace(/\D/g, "");
      if (phoneStr && phoneStr.length !== 10) {
        return res.status(400).json({ message: "Phone number must be exactly 10 digits" });
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
