import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    originalKey: { type: String, required: true, unique: true },
    hlsKey: { type: String },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending"
    },
    qualities: [{ type: String }],
    error: { type: String },
    duration: { type: Number }
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);
