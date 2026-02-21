import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    lessonsCompleted: [{ type: mongoose.Schema.Types.ObjectId }],
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    score: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Progress = mongoose.model("Progress", progressSchema);

