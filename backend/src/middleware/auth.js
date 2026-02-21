import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.sub === "admin-static" && decoded.role === "admin") {
      req.user = {
        _id: "admin-static",
        name: "Administrator",
        email: config.adminEmail,
        role: "admin"
      };
      return next();
    }

    const user = await User.findById(decoded.sub).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
