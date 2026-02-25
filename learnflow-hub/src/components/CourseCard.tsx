import { useState } from "react";
import { Star, Clock, Users, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { getThumbnailSrc } from "@/lib/api";
import type { Course } from "@/lib/mockData";

interface CourseCardProps {
  course: Course;
  showProgress?: boolean;
  progress?: number;
  /** Smaller card with reduced icon for dense grids (e.g. My Learning) */
  compact?: boolean;
}

const levelColors: Record<string, string> = {
  Beginner: "bg-emerald-500/95 text-white",
  Intermediate: "bg-amber-500/95 text-white",
  Advanced: "bg-rose-500/95 text-white",
};

const renderStars = (rating: number, compact?: boolean) => {
  const full = Math.min(5, Math.floor(rating));
  const size = compact ? "h-3 w-3" : "h-4 w-4";
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={`${size} ${i < full ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
  ));
};

const CourseCard = ({ course, showProgress, progress, compact }: CourseCardProps) => {
  const [imgError, setImgError] = useState(false);
  const thumbSrc = getThumbnailSrc(course.image) || course.image;

  return (
    <Link
      to={`/course/${course.id}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {!imgError && thumbSrc ? (
          <img
            src={thumbSrc}
            alt={course.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-100">
            <BookOpen className={compact ? "h-6 w-6 text-gray-400" : "h-12 w-12 text-gray-400"} />
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded px-2 py-0.5 font-medium ${levelColors[course.level] ?? levelColors.Beginner} ${compact ? "text-[9px]" : "text-xs"}`}
        >
          {course.level}
        </span>
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        <p className={`mb-1 font-semibold uppercase tracking-widest text-amber-600 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {course.category}
        </p>
        <h3 className={`mb-1.5 line-clamp-2 font-bold leading-snug text-gray-900 transition-colors group-hover:text-amber-600 ${compact ? "text-xs" : "text-sm"}`}>
          {course.title}
        </h3>
        <p className={`mb-2 text-gray-600 ${compact ? "text-[10px]" : "text-xs"}`}>{course.instructor}</p>

        <div className={`mb-2 flex items-center gap-1.5 ${compact ? "text-[10px]" : "text-xs"}`}>
          <span className="font-semibold text-gray-900">{course.rating.toFixed(1)}</span>
          <div className="flex gap-0.5">{renderStars(course.rating, compact)}</div>
          <span className="text-gray-500">({course.students.toLocaleString()})</span>
        </div>

        <div className={`flex items-center justify-between gap-2 ${compact ? "text-xs" : ""}`}>
          <span className={compact ? "text-sm font-bold text-gray-900" : "text-lg font-bold text-gray-900"}>${course.price}</span>
          {course.duration && (
            <span className={`flex items-center gap-1 text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}>
              <Clock className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
              {course.duration}
            </span>
          )}
        </div>

        {showProgress && progress !== undefined && (
          <div className={compact ? "mt-2" : "mt-3"}>
            <div className={`mb-1 flex justify-between text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}>
              <span>{progress}% complete</span>
            </div>
            <div className={`overflow-hidden rounded-full bg-gray-200 ${compact ? "h-1" : "h-1.5"}`}>
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
};

export default CourseCard;
