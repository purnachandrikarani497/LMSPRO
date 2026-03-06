/**
 * Burns watermark (email + phone) into video via FFmpeg.
 * Uses file input for reliability - downloads from S3 to temp, processes, streams out.
 */
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Download S3 stream to temp file, run FFmpeg with watermark, stream output.
 * Uses text_file to avoid escaping issues with email/phone (e.g. @ in email).
 */
export async function createWatermarkedStreamFromS3(s3BodyStream, watermarkText, inputFormat, res) {
  const workDir = path.join(os.tmpdir(), `wm-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const inputPath = path.join(workDir, `in.${inputFormat === "webm" ? "webm" : "mp4"}`);
  const writeStream = fs.createWriteStream(inputPath);

  // Inline text: " at " avoids @ parsing issues. Static position for reliability on Windows.
  const safeText = watermarkText.replace(/@/g, " at ").replace(/'/g, "").replace(/[:\\()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  if (!safeText) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw new Error("Watermark text is empty");
  }

  try {
    await pipeline(s3BodyStream, writeStream);
  } catch (err) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw err;
  }

  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const cmd = ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `drawtext=text='${safeText}':fontsize=20:fontcolor=white:x=20:y=h-th-40:box=1:boxcolor=black@0.6:boxborderw=4`,
        "-c:a",
        "copy",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof"
      ])
      .format("mp4");

    cmd.on("error", (err) => {
      if (done) return;
      const msg = String(err?.message || err);
      if (/Output stream closed|SIGKILL|SIGPIPE|pipe|EPIPE|closed|ECONNRESET|killed/i.test(msg)) {
        finish();
        return;
      }
      console.error("Watermark FFmpeg error:", msg);
      done = true;
      cleanup();
      reject(err);
    });
    cmd.on("end", finish);

    res.on("close", finish);
    res.on("error", finish);

    try {
      cmd.pipe(res, { end: true });
    } catch (e) {
      finish();
    }
  });
}
