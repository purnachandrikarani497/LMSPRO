import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String }
  },
  { timestamps: true }
);

export const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

