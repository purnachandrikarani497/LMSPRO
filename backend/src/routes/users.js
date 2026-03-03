import express from "express";
import { User } from "../models/User.js";
import { Enrollment } from "../models/Enrollment.js";
import { Progress } from "../models/Progress.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find({ role: "student" })
      .select("name email createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const enrollments = await Enrollment.find()
      .populate("course", "title price")
      .populate("student", "name email")
      .lean();

    const progressList = await Progress.find()
      .populate("course", "title")
      .populate("student", "name email")
      .lean();

    const usersWithActivity = users.map((u) => {
      const userEnrollments = enrollments.filter(
        (e) => e.student && String(e.student._id) === String(u._id)
      );
      const userProgress = progressList.filter(
        (p) => p.student && String(p.student._id) === String(u._id)
      );
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        enrollmentsCount: userEnrollments.length,
        enrollments: userEnrollments.map((e) => ({
          course: e.course?.title,
          price: e.course?.price,
          enrolledAt: e.createdAt
        })),
        progress: userProgress.map((p) => ({
          course: p.course?.title,
          lessonsCompleted: (p.lessonsCompleted || []).length,
          status: p.status,
          lastActivity: p.updatedAt
        }))
      };
    });

    res.json(usersWithActivity);
  } catch (error) {
    console.error("Users list error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

export default router;
