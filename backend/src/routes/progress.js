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

router.post("/:courseId/lessons/:lessonId/timestamp", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(404).json({ message: "Progress not found" });
    }
    const { timestamp, duration } = req.body;
    if (typeof timestamp !== "number") {
      return res.status(400).json({ message: "timestamp is required" });
    }
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }
    progress.watchTimestamps.set(req.params.lessonId, timestamp);
    if (typeof duration === "number" && duration > 0) {
      progress.lessonDurations.set(req.params.lessonId, duration);
    }
    let autoCompleted = false;
    if (typeof duration === "number" && duration > 0 && timestamp / duration >= 0.9) {
      const lessonId = String(req.params.lessonId);
      const alreadyCompleted = progress.lessonsCompleted.some((id) => String(id) === lessonId);
      if (!alreadyCompleted) {
        progress.lessonsCompleted.push(lessonId);
        autoCompleted = true;
      }
    }
    const course = await Course.findById(req.params.courseId);
    if (course && progress.lessonsCompleted.length >= course.lessons.length) {
      progress.status = "completed";
    }
    await progress.save();
    res.json({ lessonId: req.params.lessonId, timestamp, duration, autoCompleted });
  } catch (error) {
    res.status(500).json({ message: "Failed to save timestamp" });
  }
});

router.get("/:courseId/timestamps", requireAuth, async (req, res) => {
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
    const timestamps = {};
    const durations = {};
    const notes = {};
    if (progress.watchTimestamps) {
      for (const [k, v] of progress.watchTimestamps) { timestamps[k] = v; }
    }
    if (progress.lessonDurations) {
      for (const [k, v] of progress.lessonDurations) { durations[k] = v; }
    }
    if (progress.notes) {
      for (const [k, v] of progress.notes) {
        const arr = Array.isArray(v) ? v : (v ? [{ text: String(v), createdAt: new Date(), videoTimestamp: 0 }] : []);
        notes[String(k)] = arr.map((n) => ({
          text: n.text,
          createdAt: n.createdAt,
          videoTimestamp: typeof n.videoTimestamp === "number" ? n.videoTimestamp : 0
        }));
      }
    }
    res.json({ timestamps, durations, notes });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch timestamps" });
  }
});

router.post("/:courseId/lessons/:lessonId/note", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course" });
    }
    const { note, videoTimestamp } = req.body;
    const noteText = typeof note === "string" ? note.trim() : "";
    if (!noteText) return res.status(400).json({ message: "Note text required" });
    const ts = typeof videoTimestamp === "number" ? Math.max(0, videoTimestamp) : 0;
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) {
      return res.status(404).json({ message: "Progress not found" });
    }
    if (!progress.notes) progress.notes = new Map();
    const lessonId = String(req.params.lessonId);
    const existing = progress.notes.get(lessonId);
    const arr = Array.isArray(existing) ? [...existing] : (existing ? [{ text: String(existing), createdAt: new Date(), videoTimestamp: 0 }] : []);
    arr.push({ text: noteText, createdAt: new Date(), videoTimestamp: ts });
    progress.notes.set(lessonId, arr);
    progress.markModified("notes");
    await progress.save();
    const saved = progress.notes.get(lessonId);
    res.json({ lessonId, note: saved });
  } catch (error) {
    res.status(500).json({ message: "Failed to save note" });
  }
});

router.put("/:courseId/lessons/:lessonId/notes/:noteIndex", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course" });
    }
    const { note } = req.body;
    const noteText = typeof note === "string" ? note.trim() : "";
    if (!noteText) return res.status(400).json({ message: "Note text required" });
    const noteIndex = parseInt(req.params.noteIndex, 10);
    if (isNaN(noteIndex) || noteIndex < 0) return res.status(400).json({ message: "Invalid note index" });
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) return res.status(404).json({ message: "Progress not found" });
    if (!progress.notes) progress.notes = new Map();
    const lessonId = String(req.params.lessonId);
    const existing = progress.notes.get(lessonId);
    const arr = Array.isArray(existing) ? [...existing] : [];
    if (noteIndex >= arr.length) return res.status(404).json({ message: "Note not found" });
    const item = arr[noteIndex];
    const updated = {
      text: noteText,
      createdAt: item?.createdAt || new Date(),
      videoTimestamp: typeof item?.videoTimestamp === "number" ? item.videoTimestamp : 0
    };
    const newArr = arr.map((n, i) => (i === noteIndex ? updated : n));
    progress.notes.set(lessonId, newArr);
    progress.markModified("notes");
    await progress.save();
    res.json({ lessonId, note: progress.notes.get(lessonId) });
  } catch (error) {
    res.status(500).json({ message: "Failed to update note" });
  }
});

router.delete("/:courseId/lessons/:lessonId/notes/:noteIndex", requireAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.courseId)) {
      return res.status(400).json({ message: "Invalid course" });
    }
    const noteIndex = parseInt(req.params.noteIndex, 10);
    if (isNaN(noteIndex) || noteIndex < 0) return res.status(400).json({ message: "Invalid note index" });
    const progress = await Progress.findOne({
      student: req.user._id,
      course: req.params.courseId
    });
    if (!progress) return res.status(404).json({ message: "Progress not found" });
    if (!progress.notes) progress.notes = new Map();
    const lessonId = String(req.params.lessonId);
    const existing = progress.notes.get(lessonId);
    const arr = Array.isArray(existing) ? [...existing] : [];
    if (noteIndex >= arr.length) return res.status(404).json({ message: "Note not found" });
    const newArr = arr.filter((_, i) => i !== noteIndex);
    progress.notes.set(lessonId, newArr);
    progress.markModified("notes");
    await progress.save();
    res.json({ lessonId, note: progress.notes.get(lessonId) });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete note" });
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
