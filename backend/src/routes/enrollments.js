import express from "express";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import { Enrollment } from "../models/Enrollment.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";

console.log("DEBUG: Config loaded in enrollments.js:", JSON.stringify({
  razorpayKeyId: config.razorpay.keyId ? "present" : "missing",
  razorpayKeySecret: config.razorpay.keySecret ? "present" : "missing"
}, null, 2));

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  console.log("DEBUG: Enrollment request received for courseId:", req.body.courseId);
  try {
    const { courseId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      console.log("DEBUG: Invalid courseId:", courseId);
      return res.status(404).json({ message: "Course not found" });
    }
    const course = await Course.findById(courseId);
    if (!course || !course.isPublished) {
      console.log("DEBUG: Course not found or not published:", courseId);
      return res.status(404).json({ message: "Course not found" });
    }
    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: courseId
    });
    if (existing) {
      console.log("DEBUG: Already enrolled in course:", courseId);
      return res.status(400).json({ message: "Already enrolled" });
    }

    // Razorpay order creation
    const options = {
      amount: Math.round(course.price * 100), // amount in smallest currency unit
      currency: "INR",
      receipt: `rcpt_${Date.now()}`.substring(0, 40) // ensure receipt length <= 40
    };

    if (options.amount <= 0) {
      console.log("DEBUG: Invalid amount:", options.amount);
      return res.status(400).json({ message: "Course price must be greater than zero" });
    }

    console.log("DEBUG: Creating Razorpay order with options:", JSON.stringify(options, null, 2));
    console.log("DEBUG: Using Razorpay Key ID:", config.razorpay.keyId);

    try {
      // Re-initialize Razorpay instance inside request handler to ensure config is loaded
      const razorpayInstance = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret
      });

      const order = await razorpayInstance.orders.create(options);
      console.log("DEBUG: Razorpay order created successfully:", order.id);
      
      // Return order details for the frontend to open Razorpay checkout
      res.status(201).json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: config.razorpay.keyId,
        courseId: courseId
      });
    } catch (err) {
      console.error("DEBUG: Razorpay order creation failed:", err);
      return res.status(400).json({ 
        message: err.description || "Payment initialization failed",
        error: err 
      });
    }
  } catch (error) {
    console.error("DEBUG: Enrollment route error:", error);
    res.status(500).json({ message: "Failed to enroll" });
  }
});

router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
    
    // In a real app, verify signature here using crypto
    // For now, assume payment successful and enroll
    
    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: courseId
    });
    
    if (existing) {
      return res.status(400).json({ message: "Already enrolled" });
    }

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
