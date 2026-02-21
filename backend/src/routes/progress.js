import express from "express";
import mongoose from "mongoose";
import { Progress } from "../models/Progress.js";
import { Course } from "../models/Course.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/:courseId", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(404).json({ message: "Progress not found" });
    }
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch progress" });
  }
});

router.post("/:courseId/lessons/:lessonId/complete", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(404).json({ message: "Progress not found" });
    }
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }
    const lessonId = req.params.lessonId;
    if (!progress.lessonsCompleted.includes(lessonId)) {
      progress.lessonsCompleted.push(lessonId);
    }
    const course = await Course.findById(req.params.courseId);
    if (course && progress.lessonsCompleted.length >= course.lessons.length) {
      progress.status = "completed";
    }
    await progress.save();
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: "Failed to update progress" });
  }
});

router.post("/:courseId/quiz/submit", requireAuth, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(404).json({ message: "Course not found" });
    }
    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    let score = 0;
    course.quiz.forEach((question, index) => {
      const submitted = answers[index];
      if (submitted === question.correctIndex) {
        score += 1;
      }
    });
    const progress = await Progress.findOneAndUpdate(
      { student: req.user._id, course: req.params.courseId },
      { score },
      { new: true }
    );
    res.json({ score, progress });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit quiz" });
  }
});

export default router;
