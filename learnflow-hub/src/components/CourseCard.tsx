import { Star, Clock, BookOpen, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/lib/mockData";

interface CourseCardProps {
  course: Course;
  showProgress?: boolean;
  progress?: number;
}

const levelColors: Record<string, string> = {
  Beginner: "bg-success/10 text-success border-success/20",
  Intermediate: "bg-secondary/20 text-secondary-foreground border-secondary/30",
  Advanced: "bg-destructive/10 text-destructive border-destructive/20",
};

const CourseCard = ({ course, showProgress, progress }: CourseCardProps) => {
  return (
    <Link
      to={`/course/${course.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <Badge className={`absolute left-3 top-3 ${levelColors[course.level]} text-xs font-medium`}>
          {course.level}
        </Badge>
        <div className="absolute right-3 top-3 rounded-md bg-card/90 px-2 py-1 text-sm font-bold text-foreground backdrop-blur-sm">
          ${course.price}
        </div>
      </div>

      <div className="p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary">
          {course.category}
        </p>
        <h3 className="mb-2 font-heading text-base font-semibold leading-snug text-card-foreground line-clamp-2 group-hover:text-secondary transition-colors">
          {course.title}
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">{course.instructor}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-secondary text-secondary" />
            {course.rating}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {course.students.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {course.duration}
          </span>
        </div>

        {showProgress && progress !== undefined && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{progress}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-gold transition-all"
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
