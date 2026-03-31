import express from "express";
import mongoose from "mongoose";
import { Course } from "../models/Course.js";
import { Category } from "../models/Category.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

async function ensureCategoryExists(name) {
  if (!name || !name.trim()) return name;
  const trimmed = name.trim();
  let cat = await Category.findOne({ name: { $regex: new RegExp(`^${trimmed}$`, "i") } });
  if (!cat) {
    const slug = trimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    cat = await Category.create({ name: trimmed, icon: "", slug });
  }
  return cat.name;
}

router.post("/:id/reviews", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const course = isObjectId
      ? await Course.findById(id).populate("reviews.user", "name")
      : await Course.findOne({ legacyId: id }).populate("reviews.user", "name");

    if (!course) {
      console.error(`[Review] Course ${id} not found`);
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.reviews) {
      course.reviews = [];
    }

    const userId = req.user._id.toString();
    const existingReview = course.reviews.find(
      (review) => review.user && review.user.toString() === userId
    );

    if (existingReview) {
      return res.status(400).json({ message: "You have already reviewed this course" });
    }

    const newReview = {
      user: req.user._id,
      rating: Number(rating),
      comment: comment,
    };

    course.reviews.push(newReview);

    const totalRating = course.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    course.rating = totalRating / course.reviews.length;

    await course.save();
    console.log(`[Review] Success for course ${id}, new rating: ${course.rating}`);

    // After saving, populate the user info on the new review to return it
    const finalCourse = await Course.findById(course._id).populate('reviews.user', 'name');
    res.status(201).json(finalCourse);
  } catch (error) {
    console.error("[Review] Error:", error);
    res.status(500).json({ message: "Failed to submit review" });
  }
});

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
      ? await Course.findById(id).populate("reviews.user", "name")
      : await Course.findOne({ legacyId: id }).populate("reviews.user", "name");

    if (!course || !course.isPublished) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Calculate rating if it's not present but reviews exist
    if (course.reviews && course.reviews.length > 0 && (!course.rating || course.rating === 0)) {
      course.rating = course.reviews.reduce((acc, review) => acc + review.rating, 0) / course.reviews.length;
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
    const { title, subtitle, description, thumbnail, instructor, category, price, level } = req.body;

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

    const alphaRegex = /^[A-Za-z\s]+$/;
    const descRegex = /^[A-Za-z0-9\s.,'\n-]+$/;
    if (!alphaRegex.test(title.trim()) || title.trim().length > 50) {
      return res.status(400).json({
        message: "Title must contain only letters and spaces, maximum 50 characters"
      });
    }
    if (!descRegex.test(description.trim()) || description.trim().length > 500) {
      return res.status(400).json({
        message: "Description can include letters, numbers, spaces and basic punctuation, maximum 500 characters"
      });
    }
    if (!alphaRegex.test(instructor.trim()) || instructor.trim().length > 50) {
      return res.status(400).json({
        message: "Instructor name must contain only letters and spaces, maximum 50 characters"
      });
    }

    const priceDigitsLength = price.toString().replace(/\D/g, "").length;
    if (priceDigitsLength > 9) {
      return res.status(400).json({
        message: "Price cannot exceed 9 digits"
      });
    }

    const categoryName = await ensureCategoryExists(category);
    const payload = {
      title,
      subtitle,
      description,
      thumbnail,
      instructor,
      category: categoryName,
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
    const newSection = { 
      title: title.trim(), 
      lessons: [] 
    };
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

function findLessonInCourse(course, lessonId) {
  const lid = String(lessonId);
  if (course.lessons && course.lessons.length > 0) {
    const flat = course.lessons.find(l => String(l._id) === lid);
    if (flat) return { lesson: flat, location: "flat" };
  }
  if (course.sections) {
    for (const section of course.sections) {
      if (!section.lessons || section.lessons.length === 0) continue;
      const found = section.lessons.find(l => String(l._id) === lid);
      if (found) return { lesson: found, location: "section", section };
    }
  }
  return null;
}

router.put("/:id/lessons/:lessonId", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id, lessonId } = req.params;
    const { title, videoUrl, pdfUrl, lessonType, content, duration } = req.body;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    const result = findLessonInCourse(course, lessonId);
    if (!result) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    const lesson = result.lesson;
    if (typeof title === "string") lesson.title = title.trim();
    if (lessonType === "pdf" || lessonType === "video") {
      lesson.lessonType = lessonType;
      if (lessonType === "pdf") {
        lesson.videoUrl = undefined;
      } else {
        lesson.pdfUrl = undefined;
      }
    }
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl?.trim() || undefined;
    if (pdfUrl !== undefined) lesson.pdfUrl = pdfUrl?.trim() || undefined;
    if (content !== undefined) lesson.content = content?.trim() || undefined;
    if (duration !== undefined) lesson.duration = duration?.trim() || undefined;
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
    const result = findLessonInCourse(course, lessonId);
    if (!result) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    if (result.location === "flat") {
      course.lessons = course.lessons.filter(l => String(l._id) !== String(lessonId));
    } else {
      result.section.lessons = result.section.lessons.filter(l => String(l._id) !== String(lessonId));
    }
    await course.save();
    res.json({ message: "Lesson deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete lesson" });
  }
});

router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const update = { ...req.body };
    const alphaRegex = /^[A-Za-z\s]+$/;
    const descRegex = /^[A-Za-z0-9\s.,'\n-]+$/;
    if (typeof update.title === "string") {
      const t = update.title.trim();
      if (!t || t.length < 2 || !alphaRegex.test(t) || t.length > 50) {
        return res.status(400).json({ message: "Invalid title: letters and spaces only, 2–50 chars" });
      }
      update.title = t;
    }
    if (typeof update.description === "string") {
      const d = update.description.trim();
      if (!d || d.length < 2 || !descRegex.test(d) || d.length > 500) {
        return res.status(400).json({ message: "Invalid description: alphanumeric with basic punctuation, 2–500 chars" });
      }
      update.description = d;
    }
    if (typeof update.instructor === "string") {
      const i = update.instructor.trim();
      if (!i || i.length < 2 || !alphaRegex.test(i) || i.length > 50) {
        return res.status(400).json({ message: "Invalid instructor: letters and spaces only, 2–50 chars" });
      }
      update.instructor = i;
    }
    if (update.price !== undefined) {
      const p = Number(update.price);
      const digits = String(p).replace(/\D/g, "");
      if (!Number.isFinite(p) || p <= 0 || digits.length > 9) {
        return res.status(400).json({ message: "Invalid price: positive number, max 9 digits" });
      }
      update.price = p;
    }
    if (update.category && update.category.trim()) {
      update.category = await ensureCategoryExists(update.category);
    }
    const course = await Course.findByIdAndUpdate(req.params.id, update, {
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
