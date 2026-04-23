import express from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Enrollment } from "../models/Enrollment.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";

const router = express.Router();
const RAZORPAY_API = "https://api.razorpay.com/v1";

async function createRazorpayOrder(amountPaise, receipt, notes) {
  const keyId = config.razorpay?.keyId;
  const keySecret = config.razorpay?.keySecret;
  if (!keyId || !keySecret) return null;

  const auth = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64");
  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw { statusCode: response.status, error: data.error || data };
  }
  return data;
}

router.post("/", requireAuth, async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(404).json({ message: "Course not found" });
    }
    const course = await Course.findById(courseId);
    if (!course || !course.isPublished) {
      return res.status(404).json({ message: "Course not found" });
    }
    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: courseId
    });
    if (existing) {
      return res.status(400).json({ message: "Already enrolled" });
    }

    const price = Number(course.price) || 0;

    // Free courses: enroll immediately (no Razorpay — used by mobile app and dev)
    if (price <= 0) {
      const enrollment = await Enrollment.create({
        student: req.user._id,
        course: courseId
      });
      await Progress.create({
        student: req.user._id,
        course: courseId,
        lessonsCompleted: [],
        status: "in_progress"
      });
      return res.status(201).json(enrollment);
    }

    const amountPaise = Math.round(price * 100);
    if (amountPaise < 100) {
      return res.status(400).json({ message: "Course price must be at least 1 INR" });
    }

    const receipt = `rcpt_${courseId}_${Date.now()}`.substring(0, 40);
    const order = await createRazorpayOrder(
      amountPaise,
      receipt,
      { courseId: String(courseId), userId: String(req.user._id) }
    );

    if (!order) {
      return res.status(503).json({ message: "Razorpay is not configured" });
    }

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency || "INR",
      key: config.razorpay?.keyId,
      courseId: courseId
    });
  } catch (error) {
    const err = error?.error || error;
    const message = err?.description || error?.message || "Payment initialization failed";
    console.error("Razorpay order creation failed:", message);
    res.status(500).json({ message });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courseId) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    const keySecret = config.razorpay?.keySecret;
    if (!keySecret) {
      return res.status(503).json({ message: "Razorpay not configured" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const course = await Course.findById(courseId);
    if (!course || !course.isPublished) {
      return res.status(404).json({ message: "Course not found" });
    }

    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: courseId
    });
    if (existing) {
      return res.status(400).json({ message: "Already enrolled" });
    }

    const enrollment = await Enrollment.create({
      student: req.user._id,
      course: courseId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });

    await Progress.create({
      student: req.user._id,
      course: courseId,
      lessonsCompleted: [],
      status: "in_progress"
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Failed to verify payment" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id }).populate(
      "course"
    );
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch enrollments" });
  }
});

router.get("/all", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate("course")
      .populate("student", "name email");
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch enrollments" });
  }
});

export default router;
