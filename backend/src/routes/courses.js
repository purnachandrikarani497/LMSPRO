import express from "express";
import mongoose from "mongoose";
import { Course } from "../models/Course.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const courses = await Course.find({ isPublished: true }).select("-quiz");
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch courses" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const course = isObjectId
      ? await Course.findById(id)
      : await Course.findOne({ legacyId: id });

    if (!course || !course.isPublished) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    console.error("Error fetching course by id:", error);
    res.status(500).json({ message: "Failed to fetch course" });
  }
});

router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { title, description, thumbnail, instructor, category, price, level } = req.body;

    const payload = {
      title,
      description,
      thumbnail,
      instructor,
      category,
      price,
      level
    };

    if (req.user && req.user._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
      payload.createdBy = req.user._id;
    }

    const course = await Course.create(payload);
    res.status(201).json(course);
  } catch (error) {
    console.error("Failed to create course:", error);
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return res.status(400).json({ message: "Course title already exists" });
    }
    res.status(500).json({ message: "Failed to create course" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: "Failed to update course" });
  }
});

router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json({ message: "Course deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete course" });
  }
});

router.post("/:id/lessons", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    course.lessons.push(req.body);
    await course.save();
    res.status(201).json(course.lessons[course.lessons.length - 1]);
  } catch (error) {
    res.status(500).json({ message: "Failed to add lesson" });
  }
});

router.post("/:id/quiz", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    course.quiz = req.body.questions || [];
    await course.save();
    res.status(201).json(course.quiz);
  } catch (error) {
    res.status(500).json({ message: "Failed to save quiz" });
  }
});

router.patch("/:id/publish", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    course.isPublished = true;
    await course.save();
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: "Failed to publish course" });
  }
});

export default router;
