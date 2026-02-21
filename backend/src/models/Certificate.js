import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    issuedAt: { type: Date, default: Date.now },
    url: { type: String }
  },
  { timestamps: true }
);

export const Certificate = mongoose.model("Certificate", certificateSchema);

