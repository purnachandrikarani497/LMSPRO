import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Category } from "../models/Category.js";
import { Course } from "../models/Course.js";

const router = express.Router();

// GET /api/categories — list all (public for course filters)
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    console.error("[Categories] List error:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

const DEFAULT_CATEGORIES = [
  { name: "Development", icon: "💻" },
  { name: "Design", icon: "🎨" },
  { name: "Business", icon: "📊" },
  { name: "Marketing", icon: "📣" },
  { name: "Data Science", icon: "🔬" },
  { name: "Photography", icon: "📷" },
  { name: "General", icon: "📚" }
];

// POST /api/categories/seed — add default categories if missing (admin only)
router.post("/seed", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const created = [];
    for (const { name, icon } of DEFAULT_CATEGORIES) {
      const exists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
      if (!exists) {
        const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const cat = await Category.create({ name, icon: icon || "", slug });
        created.push(cat);
      }
    }
    res.json({ message: `${created.length} categories added`, created });
  } catch (err) {
    console.error("[Categories] Seed error:", err);
    res.status(500).json({ message: "Failed to seed categories" });
  }
});

// POST /api/categories — create (admin only)
router.post("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }
    const slug = (name || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, "i") } });
    if (existing) {
      return res.status(400).json({ message: "A category with this name already exists" });
    }
    const category = await Category.create({ name: name.trim(), icon: (icon || "").trim(), slug });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "A category with this name already exists" });
    }
    console.error("[Categories] Create error:", err);
    res.status(500).json({ message: "Failed to create category" });
  }
});

// PUT /api/categories/:id — update (admin only)
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const existing = await Category.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
    });
    if (existing) {
      return res.status(400).json({ message: "A category with this name already exists" });
    }
    const oldName = category.name;
    category.name = name.trim();
    category.icon = (icon || "").trim();
    category.slug = (name.trim()).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    await category.save();

    if (oldName !== category.name) {
      await Course.updateMany({ category: oldName }, { $set: { category: category.name } });
    }
    res.json(category);
  } catch (err) {
    console.error("[Categories] Update error:", err);
    res.status(500).json({ message: "Failed to update category" });
  }
});

// DELETE /api/categories/:id — delete (admin only)
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const name = category.name;
    await category.deleteOne();
    await Course.updateMany({ category: name }, { $set: { category: "General" } });
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("[Categories] Delete error:", err);
    res.status(500).json({ message: "Failed to delete category" });
  }
});

export default router;
