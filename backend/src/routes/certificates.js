import express from "express";
import mongoose from "mongoose";
import { Certificate } from "../models/Certificate.js";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/:courseId", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(404).json({ message: "Course not found" });
    }
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress || progress.status !== "completed") {
      return res.status(400).json({ message: "Course not completed" });
    }
    const existing = await Certificate.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (existing) {
      return res.json(existing);
    }
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const certificate = await Certificate.create({
      student: req.user._id,
      course: req.params.courseId
    });
    res.status(201).json(certificate);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate certificate" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const certificates = await Certificate.find({ student: req.user._id }).populate(
      "course"
    );
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch certificates" });
  }
});

export default router;
