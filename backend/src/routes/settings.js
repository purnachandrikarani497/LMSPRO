import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";
import { Category } from "../models/Category.js";

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { name: "Development", icon: "💻" },
  { name: "Design", icon: "🎨" },
  { name: "Business", icon: "📊" },
  { name: "Marketing", icon: "📣" },
  { name: "Data Science", icon: "🔬" },
  { name: "Photography", icon: "📷" },
  { name: "General", icon: "📚" }
];

router.post("/categories/seed", requireAuth, requireRole(["admin"]), async (req, res) => {
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
    console.error("[Settings] Seed categories error:", err);
    res.status(500).json({ message: "Failed to seed categories" });
  }
});

router.get("/", requireAuth, requireRole(["admin"]), (req, res) => {
  res.json({
    clientUrl: config.clientUrl,
    adminEmail: config.adminEmail ? `${config.adminEmail.slice(0, 3)}***@***` : null,
    razorpayConfigured: !!(config.razorpay?.keyId && config.razorpay?.keySecret),
    smtpConfigured: !!(config.email?.host && config.email?.user)
  });
});

export default router;
