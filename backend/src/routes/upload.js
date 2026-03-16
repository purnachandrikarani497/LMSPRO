/**
 * S3 upload for course thumbnails.
 * Ensure your bucket "lms-s3-speshway" allows public GetObject for thumbnails/*.
 * In AWS Console: S3 → bucket → Permissions → Bucket Policy.
 * Example policy for public read: { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::lms-s3-speshway/thumbnails/*" }
 */
import express from "express";
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

const router = express.Router();

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

const s3 = new S3Client({
  region: config.s3.region,
  credentials: config.s3.accessKeyId && config.s3.secretAccessKey
    ? {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey
      }
    : undefined
});

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

router.get("/stream/lesson/:courseId/:lessonId", async (req, res) => {
  // Reject direct navigation (opening URL in new tab, address bar, or "Open in new tab" from DevTools)
  const secFetchDest = req.get("Sec-Fetch-Dest");
  if (secFetchDest === "document") {
    return res.status(403).json({ message: "Video must be viewed from the course page" });
  }

  const referer = req.get("Referer") || req.get("Referrer");
  const origin = req.get("Origin");
  const allowedOrigins = [config.clientUrl, "http://localhost:5173", "http://localhost:8080", "http://localhost:3000"];
  const fromApp = (referer && allowedOrigins.some((o) => referer.startsWith(o))) || (origin && allowedOrigins.some((o) => origin.startsWith(o)));
  if (!fromApp) {
    return res.status(403).json({ message: "Video must be viewed from the course page" });
  }

  const token = req.query.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
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

  const isEnrolled = await Enrollment.findOne({ student: decoded.sub || decoded._id, course: courseId });
  const isAdmin = decoded.role === "admin";
  if (!isEnrolled && !isAdmin) return res.status(403).json({ message: "Enrollment required" });

  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) return res.status(503).json({ message: "S3 not configured" });

  try {
    const getParams = { Bucket: config.s3.bucket, Key: key };
    const obj = await s3.send(new GetObjectCommand(getParams));
    const rangeHeader = req.headers.range;
    if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader)) getParams.Range = rangeHeader;
    const objWithRange = rangeHeader ? await s3.send(new GetObjectCommand({ ...getParams, Range: rangeHeader })) : obj;
    const stream = objWithRange.Body;

    res.setHeader("Content-Type", obj.ContentType || "video/mp4");
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("Accept-Ranges", "bytes");
    if (objWithRange.ContentRange) {
      res.status(206);
      res.setHeader("Content-Range", objWithRange.ContentRange);
      if (objWithRange.ContentLength != null) res.setHeader("Content-Length", objWithRange.ContentLength);
    }
    if (stream && typeof stream.pipe === "function") {
      await pipeline(stream, res);
    } else {
      const buf = await stream.transformToByteArray();
      res.setHeader("Content-Length", buf.length);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("Stream fetch error:", err?.message || err);
    if (!res.headersSent) res.status(502).json({ message: "Could not load video" });
  }
});

router.get("/video", async (req, res) => {
  const key = req.query.key;
  const token = req.query.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!key || typeof key !== "string" || !key.startsWith("videos/") || key.includes("..")) {
    return res.status(400).json({ message: "Invalid video key" });
  }
  if (!token) {
    return res.status(401).json({ message: "Authentication required to stream video" });
  }
  try {
    jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
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
    const token = req.query.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
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
