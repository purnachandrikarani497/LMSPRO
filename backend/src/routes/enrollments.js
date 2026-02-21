import express from "express";
import mongoose from "mongoose";
import { Enrollment } from "../models/Enrollment.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

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
    res.status(500).json({ message: "Failed to enroll" });
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
