import express from "express";
import mongoose from "mongoose";
import dns from "node:dns";

// Fix for querySrv ECONNREFUSED on Windows/Node.js - use reliable DNS for MongoDB Atlas SRV lookup
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import enrollmentRoutes from "./routes/enrollments.js";
import progressRoutes from "./routes/progress.js";
import certificateRoutes from "./routes/certificates.js";
import uploadRoutes from "./routes/upload.js";

const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.clientUrl,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080"
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Ensure DB is connected before handling API requests (avoids "restart to fix" when connection drops)
app.use("/api", async (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  if (req.path === "/health") return next();
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      retryWrites: true
    });
    console.log("MongoDB reconnected on request");
  } catch (err) {
    console.error("Reconnect failed:", err.message);
    return res.status(503).json({
      message: "Database temporarily unavailable. Please try again in a moment.",
      code: "DB_DISCONNECTED"
    });
  }
  next();
});

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : dbState === 3 ? "disconnecting" : "disconnected";
  res.json({
    status: dbState === 1 ? "ok" : "degraded",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/upload", uploadRoutes);

const connectWithRetry = async (retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true
      });
      console.log("MongoDB connected");
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected – will auto-reconnect");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

connectWithRetry()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB after retries", error);
    process.exit(1);
  });
