/**
 * S3 upload for course thumbnails.
 * Ensure your bucket "lms-s3-speshway" allows public GetObject for thumbnails/*.
 * In AWS Console: S3 → bucket → Permissions → Bucket Policy.
 * Example policy for public read: { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::lms-s3-speshway/thumbnails/*" }
 */
import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { randomUUID } from "node:crypto";

const router = express.Router();

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
      if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
        return res.status(500).json({ message: "S3 upload is not configured" });
      }

      const ext = req.file.originalname.split(".").pop() || "jpg";
      const key = `thumbnails/${randomUUID()}.${ext}`;

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

router.get("/video", async (req, res) => {
  const key = req.query.key;
  if (!key || typeof key !== "string" || !key.startsWith("videos/") || key.includes("..")) {
    return res.status(400).json({ message: "Invalid video key" });
  }
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey) {
    return res.status(503).json({ message: "S3 not configured" });
  }
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    const contentType = obj.ContentType || "video/mp4";
    const buf = await obj.Body.transformToByteArray();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Type", contentType);
    res.send(Buffer.from(buf));
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
      res.send(Buffer.from(buf));
    } else {
      const r = await fetch(url, { headers: { Accept: "image/*" } });
      if (!r.ok) throw new Error("Fetch failed");
      const contentType = r.headers.get("Content-Type") || "image/jpeg";
      const buf = await r.arrayBuffer();
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(buf));
    }
  } catch (err) {
    console.error("Proxy fetch error:", err?.message || err);
    res.status(502).json({ message: "Could not fetch image" });
  }
});

export default router;
