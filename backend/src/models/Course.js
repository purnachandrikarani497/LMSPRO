import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    videoUrl: { type: String },
    content: { type: String },
    resources: [{ type: String }]
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true }
  },
  { _id: true }
);

const courseSchema = new mongoose.Schema(
  {
    legacyId: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String },
    instructor: { type: String },
    category: { type: String },
    price: { type: Number },
    rating: { type: Number, default: 0 },
    students: { type: Number, default: 0 },
    duration: { type: String },
    level: { type: String },
    lessons: [lessonSchema],
    quiz: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isPublished: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Course = mongoose.model("Course", courseSchema);
