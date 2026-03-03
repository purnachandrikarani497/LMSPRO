import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { Video } from "../models/Video.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

const s3 = new S3Client({
  region: config.s3.region,
  credentials:
    config.s3.accessKeyId && config.s3.secretAccessKey
      ? { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }
      : undefined
});

const QUALITY_PRESETS = [
  { tag: "360p", width: 640, height: 360, bitrate: "800k", audioBitrate: "96k" },
  { tag: "480p", width: 854, height: 480, bitrate: "1400k", audioBitrate: "128k" },
  { tag: "720p", width: 1280, height: 720, bitrate: "2800k", audioBitrate: "128k" }
];

const transcodeQueue = [];
let isProcessing = false;

export function enqueueTranscode(originalKey) {
  if (transcodeQueue.includes(originalKey)) return;
  transcodeQueue.push(originalKey);
  processQueue();
}

async function processQueue() {
  if (isProcessing || transcodeQueue.length === 0) return;
  isProcessing = true;
  const key = transcodeQueue.shift();
  try {
    await transcodeVideo(key);
  } catch (err) {
    console.error("Transcode queue error:", err?.message || err);
  }
  isProcessing = false;
  if (transcodeQueue.length > 0) processQueue();
}

async function transcodeVideo(originalKey) {
  const videoDoc = await Video.findOneAndUpdate(
    { originalKey },
    { status: "processing", error: null },
    { new: true, upsert: true }
  );

  const workDir = path.join(os.tmpdir(), `hls-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const inputPath = path.join(workDir, "input.mp4");

  try {
    console.log(`[HLS] Downloading ${originalKey}...`);
    const obj = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: originalKey }));
    const writeStream = fs.createWriteStream(inputPath);
    await pipeline(obj.Body, writeStream);

    const probe = await probeVideo(inputPath);
    const sourceHeight = probe.height || 1080;
    const duration = probe.duration || 0;

    const qualities = QUALITY_PRESETS.filter((q) => q.height <= sourceHeight);
    if (qualities.length === 0) qualities.push(QUALITY_PRESETS[0]);

    const hlsBase = originalKey.replace(/\.[^.]+$/, "").replace("videos/", "hls/");

    for (const q of qualities) {
      console.log(`[HLS] Transcoding ${q.tag}...`);
      const qDir = path.join(workDir, q.tag);
      fs.mkdirSync(qDir, { recursive: true });

      await runFfmpeg(inputPath, qDir, q);

      console.log(`[HLS] Uploading ${q.tag} segments...`);
      const files = fs.readdirSync(qDir);
      for (const file of files) {
        const filePath = path.join(qDir, file);
        const s3Key = `${hlsBase}/${q.tag}/${file}`;
        const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
        await s3.send(
          new PutObjectCommand({
            Bucket: config.s3.bucket,
            Key: s3Key,
            Body: fs.readFileSync(filePath),
            ContentType: contentType
          })
        );
      }
    }

    const masterPlaylist = generateMasterPlaylist(qualities, hlsBase);
    const masterKey = `${hlsBase}/master.m3u8`;
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: masterKey,
        Body: masterPlaylist,
        ContentType: "application/vnd.apple.mpegurl"
      })
    );

    await Video.findByIdAndUpdate(videoDoc._id, {
      status: "ready",
      hlsKey: masterKey,
      qualities: qualities.map((q) => q.tag),
      duration
    });

    console.log(`[HLS] Done: ${masterKey}`);
  } catch (err) {
    console.error(`[HLS] Failed for ${originalKey}:`, err?.message || err);
    await Video.findByIdAndUpdate(videoDoc._id, {
      status: "failed",
      error: String(err?.message || err).slice(0, 500)
    });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams?.find((s) => s.codec_type === "video");
      resolve({
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        duration: parseFloat(data.format?.duration) || 0
      });
    });
  });
}

function runFfmpeg(inputPath, outputDir, quality) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${quality.width}:${quality.height}:force_original_aspect_ratio=decrease,pad=${quality.width}:${quality.height}:(ow-iw)/2:(oh-ih)/2`,
        `-c:v libx264`,
        `-b:v ${quality.bitrate}`,
        `-c:a aac`,
        `-b:a ${quality.audioBitrate}`,
        `-preset fast`,
        `-g 48`,
        `-keyint_min 48`,
        `-sc_threshold 0`,
        `-hls_time 6`,
        `-hls_list_size 0`,
        `-hls_segment_filename ${path.join(outputDir, "seg%03d.ts").replace(/\\/g, "/")}`
      ])
      .output(path.join(outputDir, "playlist.m3u8").replace(/\\/g, "/"))
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function generateMasterPlaylist(qualities, hlsBase) {
  let m3u8 = "#EXTM3U\n";
  for (const q of qualities) {
    const bw = parseInt(q.bitrate) * 1000;
    m3u8 += `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${q.width}x${q.height},NAME="${q.tag}"\n`;
    m3u8 += `${q.tag}/playlist.m3u8\n`;
  }
  return m3u8;
}

export async function getVideoStatus(originalKey) {
  return Video.findOne({ originalKey }).lean();
}

export async function retranscode(originalKey) {
  await Video.findOneAndUpdate({ originalKey }, { status: "pending", error: null });
  enqueueTranscode(originalKey);
}
