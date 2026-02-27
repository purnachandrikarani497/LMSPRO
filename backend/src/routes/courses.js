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

router.get("/:id/admin", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const id = req.params.id;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

    const course = isObjectId
      ? await Course.findById(id)
      : await Course.findOne({ legacyId: id });

    if (!course) {
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

    if (
      !title ||
      !title.trim() ||
      title.trim().length < 2 ||
      !description ||
      !description.trim() ||
      description.trim().length < 2 ||
      !thumbnail ||
      !thumbnail.trim() ||
      thumbnail.trim().length < 2 ||
      !instructor ||
      !instructor.trim() ||
      instructor.trim().length < 2 ||
      !category ||
      !category.trim() ||
      category.trim().length < 2 ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return res.status(400).json({
        message: "All fields are required, must be at least 2 characters, and price must be a positive number"
      });
    }

    const priceDigitsLength = price.toString().replace(/\D/g, "").length;
    if (priceDigitsLength > 9) {
      return res.status(400).json({
        message: "Price cannot exceed 9 digits"
      });
    }

    const payload = {
      title,
      description,
      thumbnail,
      instructor,
      category,
      price,
      level,
      isPublished: true
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

router.post("/:id/sections", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Section title is required" });
    }
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (!course.sections) {
      course.sections = [];
    }
    const newSection = { title: title.trim(), lessons: [] };
    course.sections.push(newSection);
    await course.save();
    res.status(201).json(course.sections[course.sections.length - 1]);
  } catch (error) {
    res.status(500).json({ message: "Failed to create section" });
  }
});

router.post("/:id/sections/:sectionId/lessons", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (!course.sections) {
      course.sections = [];
    }
    const section = course.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }
    section.lessons.push(req.body);
    await course.save();
    res.status(201).json(section.lessons[section.lessons.length - 1]);
  } catch (error) {
    res.status(500).json({ message: "Failed to add lesson to section" });
  }
});

router.put("/:id/sections/:sectionId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const { title } = req.body;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const section = course.sections.id(sectionId);
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }
    if (typeof title === "string") section.title = title.trim();
    await course.save();
    res.json(section);
  } catch (error) {
    res.status(500).json({ message: "Failed to update section" });
  }
});

router.delete("/:id/sections/:sectionId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    course.sections.pull(sectionId);
    await course.save();
    res.json({ message: "Section deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete section" });
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

router.put("/:id/lessons/:lessonId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, lessonId } = req.params;
    const { title, videoUrl, content, duration, resources } = req.body;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const lesson = course.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    if (typeof title === "string") lesson.title = title.trim();
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl?.trim() || undefined;
    if (content !== undefined) lesson.content = content?.trim() || undefined;
    if (duration !== undefined) lesson.duration = duration?.trim() || undefined;
    if (Array.isArray(resources)) lesson.resources = resources;
    await course.save();
    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: "Failed to update lesson" });
  }
});

router.delete("/:id/lessons/:lessonId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, lessonId } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const lesson = course.lessons.id(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    course.lessons.pull(lessonId);
    await course.save();
    res.json({ message: "Lesson deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete lesson" });
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
