import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    videoUrl: { type: String },
    content: { type: String },
    duration: { type: String },
    resources: [{ type: String }]
  },
  { _id: true }
);

const sectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    lessons: [lessonSchema]
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
    subtitle: { type: String },
    description: { type: String, required: true },
    thumbnail: { type: String },
    instructor: { type: String },
    instructorPhoto: { type: String },
    instructorTitle: { type: String },
    instructorBio: { type: String },
    category: { type: String },
    price: { type: Number },
    rating: { type: Number, default: 0 },
    students: { type: Number, default: 0 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, required: true },
        comment: { type: String, required: true },
      },
    ],
    duration: { type: String },
    level: { type: String },
    previewVideoUrl: { type: String },
    sections: [sectionSchema],
    lessons: [lessonSchema],
    quiz: [questionSchema],
    announcements: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        postedAt: { type: Date, default: Date.now }
      }
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isPublished: { type: Boolean, default: false }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

courseSchema.virtual("ratingCount").get(function () {
  return this.reviews ? this.reviews.length : 0;
});

export const Course = mongoose.model("Course", courseSchema);
