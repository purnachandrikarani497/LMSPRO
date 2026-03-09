import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    slug: { type: String, trim: true }
  },
  { timestamps: true }
);

// Index for unique name (case-insensitive)
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Category = mongoose.model("Category", categorySchema);
