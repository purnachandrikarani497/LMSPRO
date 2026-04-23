/**
 * S3 upload for course thumbnails.
 * Ensure your bucket "lms-s3-speshway" allows public GetObject for thumbnails/*.
 * In AWS Console: S3 → bucket → Permissions → Bucket Policy.
 * Example policy for public read: { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::lms-s3-speshway/thumbnails/*" }
 */
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import jwt from "jsonwebtoken";
import { pipeline } from "node:stream/promises";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { randomUUID } from "node:crypto";
import { enqueueTranscode, getVideoStatus } from "../services/transcoder.js";
import { Video } from "../models/Video.js";
import { Course } from "../models/Course.js";
import { Enrollment } from "../models/Enrollment.js";
import { Progress } from "../models/Progress.js";

const router = express.Router();

/** JWT for lesson/video streams: query (?token=), Authorization, or X-LMS-Stream-Token (some CDNs strip Authorization on media GETs). */
function extractStreamJwt(req) {
  let q = req.query.token;
  if (Array.isArray(q)) q = q.find((x) => typeof x === "string" && x.trim().length > 0) ?? q[0];
  if (typeof q === "string" && q.trim().length > 0) return q.trim();
  const auth = req.headers.authorization;
  if (typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(\S+)/i);
    if (m) return m[1].trim();
  }
  const x = req.headers["x-lms-stream-token"];
  if (typeof x === "string" && x.trim().length > 0) return x.trim();
  return null;
}

/** Match [Enrollment] / [Progress] whether `student` was stored as a string or ObjectId. */
function studentIdCandidatesForStream(decoded) {
  const raw = decoded.sub ?? decoded._id;
  if (raw == null || raw === "") return [];
  const s = String(raw).trim();
  const out = [s];
  if (/^[a-fA-F0-9]{24}$/.test(s)) {
    try {
      out.push(new mongoose.Types.ObjectId(s));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Match [course] id whether stored as string or ObjectId (same as [student]). */
function courseIdCandidatesForStream(courseId) {
  if (courseId == null || courseId === "") return [];
  const s = String(courseId).trim();
  const out = [s];
  if (/^[a-fA-F0-9]{24}$/.test(s)) {
    try {
      out.push(new mongoose.Types.ObjectId(s));
    } catch {
      /* ignore */
    }
  }
  return out;
}

/** Student may load lesson streams if admin, enrolled, or has progress for the course (mobile + web). */
async function userMayAccessStreamContent(decoded, courseId) {
  if (decoded.role === "admin") return true;
  const sc = studentIdCandidatesForStream(decoded);
  const cc = courseIdCandidatesForStream(courseId);
  if (sc.length === 0 || cc.length === 0) return false;
  const q = { student: { $in: sc }, course: { $in: cc } };
  if (await Enrollment.findOne(q)) return true;
  if (await Progress.findOne(q)) return true;
  return false;
}

function extractVideoKeyFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("videos/")) return url;
  const m = url.match(/[?&]key=([^&]+)/);
  if (m) {
    const k = decodeURIComponent(m[1]);
    if (k.startsWith("videos/")) return k;
  }
  return null;
}

function extractPdfKeyFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("pdfs/")) return url;
  const m = url.match(/[?&]key=([^&]+)/);
  if (m) {
    const k = decodeURIComponent(m[1]);
    if (k.startsWith("pdfs/")) return k;
  }
  return null;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG, WebP, GIF) are allowed"));
    }
  }
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only videos (MP4, WebM, OGG) are allowed"));
    }
  }
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf"];
    if (allowed.includes(file.mimetype) || (file.originalname || "").toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  }
});

const s3 = new S3Client({
  region: config.s3.region,
  credentials: config.s3.accessKeyId && config.s3.secretAccessKey
    ? {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey
      }
    : undefined
});

async function streamLocalPdf(req, res, key) {
  const safeName = path.basename(key);
  const localDir = path.resolve(process.cwd(), "uploads", "pdfs");
  const localPath = path.join(localDir, safeName);
  if (!localPath.startsWith(localDir)) {
    return res.status(400).json({ message: "Invalid path" });
  }
  let stat;
  try {
    stat = await fs.promises.stat(localPath);
  } catch {
    return res.status(404).json({ message: "PDF not found" });
  }
  const size = stat.size;
  const range = req.headers.range;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-cache");
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      const safeEnd = Math.min(end, size - 1);
      const chunkSize = safeEnd - start + 1;
      if (start >= size || start > safeEnd) {
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${safeEnd}/${size}`);
      res.setHeader("Content-Length", chunkSize);
      await pipeline(fs.createReadStream(localPath, { start, end: safeEnd }), res);
      return;
    }
  }
  res.setHeader("Content-Length", size);
  await pipeline(fs.createReadStream(localPath), res);
}

router.post(
  "/thumbnail",
  requireAuth,
  requireRole(["admin"]),
  (req, res, next) => {
    imageUpload.single("file")(req, res, (err) => {
      if (err) {
        if (err.message?.includes("Only images")) {
          return res.status(400).json({ message: err.message });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Max 5MB." });
        }
        return res.status(400).json({ message: err.message || "Upload error" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = req.file.originalname.split(".").pop() || "jpg";
      const key = `thumbnails/${randomUUID()}.${ext}`;

      // Fallback to local filesystem if S3 not configured
      if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
        const uploadsDir = path.resolve(process.cwd(), "uploads", "thumbnails");
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, path.basename(key.replace("thumbnails/", "")));
        await fs.promises.writeFile(filePath, req.file.buffer);
        const url = `${req.protocol}://${req.get("host")}/uploads/thumbnails/${path.basename(filePath)}`;
        // Return only URL so frontend uses absolute link (no proxy)
        return res.json({ url, key: "" });
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        })
      );

      const url = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
      res.json({ url, key });
    } catch (error) {
      console.error("S3 upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload image" });
    }
  }
);

router.post(
  "/video",
  requireAuth,
  requireRole(["admin"]),
  (req, res, next) => {
    videoUpload.single("file")(req, res, (err) => {
      if (err) {
        if (err.message?.includes("Only videos")) {
          return res.status(400).json({ message: err.message });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Max 100MB." });
        }
        return res.status(400).json({ message: err.message || "Upload error" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
        return res.status(500).json({ message: "S3 upload is not configured" });
      }

      const ext = req.file.originalname.split(".").pop() || "mp4";
      const key = `videos/${randomUUID()}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        })
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const playUrl = `${baseUrl}/api/upload/video?key=${encodeURIComponent(key)}`;

      res.json({ url: playUrl, key });
    } catch (error) {
      console.error("Video upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload video" });
    }
  }
);

router.post(
  "/pdf",
  requireAuth,
  requireRole(["admin"]),
  (req, res, next) => {
    pdfUpload.single("file")(req, res, (err) => {
      if (err) {
        if (err.message?.includes("Only PDF")) {
          return res.status(400).json({ message: err.message });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large. Max 40MB." });
        }
        return res.status(400).json({ message: err.message || "Upload error" });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const ext = (req.file.originalname.split(".").pop() || "pdf").toLowerCase();
      const safeExt = ext === "pdf" ? "pdf" : "pdf";
      const key = `pdfs/${randomUUID()}.${safeExt}`;

      if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
        const uploadsDir = path.resolve(process.cwd(), "uploads", "pdfs");
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, path.basename(key.replace("pdfs/", "")));
        await fs.promises.writeFile(filePath, req.file.buffer);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const playUrl = `${baseUrl}/api/upload/pdf?key=${encodeURIComponent(key)}`;
        return res.json({ url: playUrl, key });
      }

      await s3.send(
        new PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: req.file.buffer,
          ContentType: "application/pdf"
        })
      );

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const playUrl = `${baseUrl}/api/upload/pdf?key=${encodeURIComponent(key)}`;
      res.json({ url: playUrl, key });
    } catch (error) {
      console.error("PDF upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload PDF" });
    }
  }
);

router.get("/stream/lesson/:courseId/:lessonId", async (req, res) => {
  const token = extractStreamJwt(req);
  if (!token) return res.status(401).json({ message: "Authentication required" });
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const { courseId, lessonId } = req.params;
  if (!courseId || !lessonId) return res.status(400).json({ message: "Invalid course or lesson" });

  const course = await Course.findById(courseId).lean();
  if (!course) return res.status(404).json({ message: "Course not found" });

  const allLessons = course.sections?.length
    ? course.sections.flatMap((s) => s.lessons || [])
    : (course.lessons || []);
  const lesson = allLessons.find((l) => l && String(l._id) === lessonId);
  if (!lesson || !lesson.videoUrl) return res.status(404).json({ message: "Lesson or video not found" });

  const key = extractVideoKeyFromUrl(lesson.videoUrl);
  if (!key) return res.status(404).json({ message: "Video not found" });

  const mayAccess = await userMayAccessStreamContent(decoded, courseId);
  if (!mayAccess) return res.status(403).json({ message: "Enrollment required" });

  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) return res.status(503).json({ message: "S3 not configured" });

  try {
    // Single ranged (or full) GET — do not open two S3 streams; the first unused body confuses clients (premature close / abort).
    const getParams = { Bucket: config.s3.bucket, Key: key };
    const rangeHeader = typeof req.headers.range === "string" ? req.headers.range.trim() : "";
    if (rangeHeader.startsWith("bytes=")) {
      getParams.Range = rangeHeader;
    }
    const obj = await s3.send(new GetObjectCommand(getParams));
    const stream = obj.Body;

    res.setHeader("Content-Type", obj.ContentType || "video/mp4");
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("Accept-Ranges", "bytes");
    if (obj.ContentRange) {
      res.status(206);
      res.setHeader("Content-Range", obj.ContentRange);
    } else {
      res.status(200);
    }
    if (obj.ContentLength != null && obj.ContentLength !== undefined) {
      res.setHeader("Content-Length", String(obj.ContentLength));
    }
    if (stream && typeof stream.pipe === "function") {
      try {
        await pipeline(stream, res);
      } catch (pipeErr) {
        const msg = String(pipeErr?.message || pipeErr);
        const benign =
          msg.includes("Premature close") ||
          msg.includes("premature close") ||
          msg.includes("aborted") ||
          pipeErr?.code === "ERR_STREAM_PREMATURE_CLOSE";
        if (!benign) throw pipeErr;
      }
    } else {
      const buf = await stream.transformToByteArray();
      res.setHeader("Content-Length", buf.length);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    const msg = String(err?.message || err);
    const benign =
      msg.includes("Premature close") ||
      msg.includes("premature close") ||
      msg.includes("aborted") ||
      err?.code === "ERR_STREAM_PREMATURE_CLOSE";
    if (!benign) console.error("Stream fetch error:", msg);
    if (!res.headersSent) res.status(502).json({ message: "Could not load video" });
  }
});

router.get("/stream/pdf/:courseId/:lessonId", async (req, res) => {
  const token = extractStreamJwt(req);
  if (!token) return res.status(401).json({ message: "Authentication required" });
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const { courseId, lessonId } = req.params;
  if (!courseId || !lessonId) return res.status(400).json({ message: "Invalid course or lesson" });

  const course = await Course.findById(courseId).lean();
  if (!course) return res.status(404).json({ message: "Course not found" });

  const allLessons = course.sections?.length
    ? course.sections.flatMap((s) => s.lessons || [])
    : (course.lessons || []);
  const lesson = allLessons.find((l) => l && String(l._id) === lessonId);
  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }
  if (lesson.lessonType === "video" && lesson.videoUrl) {
    return res.status(404).json({ message: "Lesson or PDF not found" });
  }
  const isPdfLesson =
    lesson.pdfUrl &&
    (lesson.lessonType === "pdf" || (lesson.lessonType !== "video" && !lesson.videoUrl));
  if (!isPdfLesson) return res.status(404).json({ message: "Lesson or PDF not found" });

  const pdfKey = extractPdfKeyFromUrl(lesson.pdfUrl);
  if (!pdfKey) return res.status(404).json({ message: "PDF not found" });

  const mayAccess = await userMayAccessStreamContent(decoded, courseId);
  if (!mayAccess) return res.status(403).json({ message: "Enrollment required" });

  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
    return streamLocalPdf(req, res, pdfKey);
  }

  try {
    const rangeHeader = typeof req.headers.range === "string" ? req.headers.range.trim() : "";
    const getParams = { Bucket: config.s3.bucket, Key: pdfKey };
    if (rangeHeader.startsWith("bytes=")) {
      getParams.Range = rangeHeader;
    }
    const obj = await s3.send(new GetObjectCommand(getParams));
    const contentType = obj.ContentType || "application/pdf";
    const contentLength = obj.ContentLength;
    const contentRange = obj.ContentRange;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-cache");

    if (contentRange) {
      res.status(206);
      res.setHeader("Content-Range", contentRange);
      if (contentLength != null) res.setHeader("Content-Length", String(contentLength));
    } else {
      res.status(200);
      if (contentLength != null) res.setHeader("Content-Length", String(contentLength));
    }

    if (obj.Body && typeof obj.Body.pipe === "function") {
      try {
        await pipeline(obj.Body, res);
      } catch (pipeErr) {
        const msg = String(pipeErr?.message || pipeErr);
        const benign =
          msg.includes("Premature close") ||
          msg.includes("premature close") ||
          msg.includes("aborted") ||
          pipeErr?.code === "ERR_STREAM_PREMATURE_CLOSE";
        if (!benign) throw pipeErr;
      }
    } else {
      const buf = await obj.Body.transformToByteArray();
      res.setHeader("Content-Length", buf.length);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    const msg = String(err?.message || err);
    const benign =
      msg.includes("Premature close") ||
      msg.includes("premature close") ||
      msg.includes("aborted") ||
      err?.code === "ERR_STREAM_PREMATURE_CLOSE";
    if (!benign) console.error("PDF stream error:", msg);
    if (!res.headersSent) res.status(502).json({ message: "Could not load PDF" });
  }
});

router.get("/video", async (req, res) => {
  const key = req.query.key;
  const token = extractStreamJwt(req);
  if (!key || typeof key !== "string" || !key.startsWith("videos/") || key.includes("..")) {
    return res.status(400).json({ message: "Invalid video key" });
  }
  if (!token) {
    try {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const previewMatch = await Course.findOne({ previewVideoUrl: { $regex: escaped } }).select("_id").lean();
      if (!previewMatch) {
        return res.status(401).json({ message: "Authentication required to stream video" });
      }
      // If this key is registered as a course preview, allow public streaming (no auth)
    } catch {
      return res.status(401).json({ message: "Authentication required to stream video" });
    }
  } else {
    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      try {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const previewMatch = await Course.findOne({ previewVideoUrl: { $regex: escaped } }).select("_id").lean();
        if (!previewMatch) {
          return res.status(401).json({ message: "Invalid or expired token" });
        }
      } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
    }
  }
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
    return res.status(503).json({ message: "S3 not configured" });
  }
  try {
    const rangeHeader = req.headers.range;
    const getParams = { Bucket: config.s3.bucket, Key: key };
    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
      getParams.Range = rangeHeader;
    }
    const obj = await s3.send(new GetObjectCommand(getParams));
    const contentType = obj.ContentType || "video/mp4";
    const contentLength = obj.ContentLength;
    const contentRange = obj.ContentRange;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-cache"); // Prevent caching for security

    if (contentRange) {
      res.status(206);
      res.setHeader("Content-Range", contentRange);
      if (contentLength != null) res.setHeader("Content-Length", contentLength);
    }

    if (obj.Body && typeof obj.Body.pipe === "function") {
      await pipeline(obj.Body, res);
    } else {
      const buf = await obj.Body.transformToByteArray();
      res.setHeader("Content-Length", buf.length);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("Video fetch error:", err?.message || err);
    res.status(502).json({ message: "Could not load video" });
  }
});

router.get("/pdf", async (req, res) => {
  const key = req.query.key;
  const token = extractStreamJwt(req);
  if (!key || typeof key !== "string" || !key.startsWith("pdfs/") || key.includes("..")) {
    return res.status(400).json({ message: "Invalid PDF key" });
  }
  if (!token) {
    return res.status(401).json({ message: "Authentication required to load PDF" });
  }
  try {
    jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
    return streamLocalPdf(req, res, key);
  }
  try {
    const rangeHeader = req.headers.range;
    const getParams = { Bucket: config.s3.bucket, Key: key };
    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) {
      getParams.Range = rangeHeader;
    }
    const obj = await s3.send(new GetObjectCommand(getParams));
    const contentType = obj.ContentType || "application/pdf";
    const contentLength = obj.ContentLength;
    const contentRange = obj.ContentRange;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-cache");

    if (contentRange) {
      res.status(206);
      res.setHeader("Content-Range", contentRange);
      if (contentLength != null) res.setHeader("Content-Length", contentLength);
    }

    if (obj.Body && typeof obj.Body.pipe === "function") {
      await pipeline(obj.Body, res);
    } else {
      const buf = await obj.Body.transformToByteArray();
      res.setHeader("Content-Length", buf.length);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("PDF fetch error:", err?.message || err);
    res.status(502).json({ message: "Could not load PDF" });
  }
});

router.get("/thumb", async (req, res) => {
  const key = req.query.key;
  if (!key || typeof key !== "string" || !key.startsWith("thumbnails/") || key.includes("..")) {
    return res.status(400).json({ message: "Invalid thumbnail key" });
  }
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
    return res.status(503).json({ message: "S3 not configured" });
  }
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    const contentType = obj.ContentType || "image/jpeg";
    const buf = await obj.Body.transformToByteArray();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("Thumbnail fetch error:", err?.message || err);
    res.status(502).json({ message: "Could not load image" });
  }
});

router.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ message: "Missing url parameter" });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return res.status(400).json({ message: "Invalid URL" });
    const host = parsed.hostname.toLowerCase();
    const allowed = host.endsWith(".amazonaws.com") || host.endsWith("images.unsplash.com") || host.endsWith("imgur.com");
    if (!allowed) return res.status(400).json({ message: "Invalid thumbnail URL" });
  } catch {
    return res.status(400).json({ message: "Invalid URL" });
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isOurS3 = host === `${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com`;

    if (isOurS3 && config.s3.accessKeyId && config.s3.secretAccessKey) {
      const key = parsed.pathname.slice(1);
      if (!key || !key.startsWith("thumbnails/")) return res.status(400).json({ message: "Invalid S3 key" });
      const obj = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
      const contentType = obj.ContentType || "image/jpeg";
      const buf = await obj.Body.transformToByteArray();
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.send(Buffer.from(buf));
    } else {
      const r = await fetch(url, { headers: { Accept: "image/*" } });
      if (!r.ok) throw new Error("Fetch failed");
      const contentType = r.headers.get("Content-Type") || "image/jpeg";
      const buf = await r.arrayBuffer();
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("Proxy fetch error:", err?.message || err);
    res.status(502).json({ message: "Could not fetch image" });
  }
});

router.get("/hls/{*hlsPath}", async (req, res) => {
  try {
    const token = extractStreamJwt(req);
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    let hlsPath = req.params.hlsPath;
    if (Array.isArray(hlsPath)) hlsPath = hlsPath.join("/");
    if (typeof hlsPath !== "string" || !hlsPath) {
      return res.status(400).json({ message: "Invalid HLS path" });
    }
    const key = hlsPath.startsWith("hls/") ? hlsPath : `hls/${hlsPath}`;
    if (key.includes("..")) {
      return res.status(400).json({ message: "Invalid HLS key" });
    }

    if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
      return res.status(503).json({ message: "S3 not configured" });
    }

    const obj = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    if (!obj || !obj.Body) {
      return res.status(404).json({ message: "HLS resource not found" });
    }

    const isPlaylist = key.endsWith(".m3u8");
    const contentType = isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", isPlaylist ? "no-cache" : "public, max-age=3600");

    if (isPlaylist) {
      const buf = await obj.Body.transformToByteArray();
      let playlist = Buffer.from(buf).toString("utf-8");
      const tokenParam = `?token=${encodeURIComponent(token)}`;
      const baseUrl = `${req.protocol}://${req.get("host")}/api/upload/hls/`;
      const keyDir = key.substring(0, key.lastIndexOf("/") + 1);

      playlist = playlist.replace(/^(?!#)(.+)$/gm, (match) => {
        if (match.startsWith("http")) return match;
        return `${baseUrl}${keyDir}${match}${tokenParam}`;
      });
      res.send(playlist);
    } else {
      if (typeof obj.Body.pipe === "function") {
        await pipeline(obj.Body, res);
      } else {
        const buf = await obj.Body.transformToByteArray();
        res.setHeader("Content-Length", buf.length);
        res.send(Buffer.from(buf));
      }
    }
  } catch (err) {
    console.error("HLS fetch error:", err?.message || err, "key:", req.params?.hlsPath);
    if (!res.headersSent) {
      const status = (err?.name === "NoSuchKey" || err?.Code === "NoSuchKey") ? 404 : 502;
      res.status(status).json({ message: "Could not load HLS content" });
    }
  }
});

router.get("/video-status", requireAuth, async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ message: "Missing key" });
  const video = await Video.findOne({ originalKey: key }).lean();
  if (!video) return res.json({ status: "none" });
  res.json({
    status: video.status,
    hlsKey: video.hlsKey,
    qualities: video.qualities,
    error: video.error
  });
});

router.post("/retranscode", requireAuth, requireRole(["admin"]), async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ message: "Missing key" });
  await Video.findOneAndUpdate({ originalKey: key }, { status: "pending", error: null }, { upsert: true });
  enqueueTranscode(key);
  res.json({ message: "Transcode queued" });
});

router.post("/transcode-all", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const Course = (await import("../models/Course.js")).default;
    const courses = await Course.find({}).lean();
    const keys = new Set();
    for (const c of courses) {
      for (const sec of c.sections || []) {
        for (const les of sec.lessons || []) {
          const url = les.videoUrl;
          if (!url) continue;
          const match = url.match(/[?&]key=([^&]+)/);
          if (match) {
            const k = decodeURIComponent(match[1]);
            if (k.startsWith("videos/")) keys.add(k);
          }
        }
      }
    }
    let queued = 0;
    for (const k of keys) {
      const existing = await Video.findOne({ originalKey: k });
      if (!existing || existing.status === "failed") {
        await Video.findOneAndUpdate({ originalKey: k }, { status: "pending", error: null }, { upsert: true });
        enqueueTranscode(k);
        queued++;
      }
    }
    res.json({ message: `Queued ${queued} videos for transcoding`, total: keys.size, queued });
  } catch (err) {
    console.error("Transcode-all error:", err);
    res.status(500).json({ message: "Failed to queue transcoding" });
  }
});

export default router;
