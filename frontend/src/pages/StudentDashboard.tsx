import { BookOpen, Clock, Award, TrendingUp } from "lucide-react";
import CourseCard from "@/components/CourseCard";
import { useQuery } from "@tanstack/react-query";
import { api, ApiEnrollment, ApiProgress, mapApiCourseToCourse } from "@/lib/api";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

interface StatCardProps {
  icon: typeof BookOpen;
  label: string;
  value: string;
}

const StatCard = ({ icon: Icon, label, value }: StatCardProps) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-card">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/15">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
      <div>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  </div>
);

const parseDurationToHours = (duration?: string | null) => {
  if (!duration) return 0;
  const match = duration.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]);
};

const StudentDashboard = () => {
  const { data: enrollments } = useQuery<ApiEnrollment[]>({
    queryKey: ["enrollments"],
    queryFn: () => api.getEnrollments()
  });

  const [progressMap, setProgressMap] = useState<Record<string, ApiProgress | undefined>>({});

  useEffect(() => {
    const loadProgress = async () => {
      if (!enrollments) return;
      const entries = await Promise.all(
        enrollments.filter(e => e.course).map(async (enrollment) => {
          try {
            const id = enrollment.course._id || enrollment.course.id || "";
            const progress = await api.getProgress(id);
            return [id, progress] as const;
          } catch {
            return [enrollment.course._id || enrollment.course.id || "", undefined] as const;
          }
        })
      );
      const next: Record<string, ApiProgress | undefined> = {};
      entries.forEach(([id, progress]) => {
        next[id] = progress;
      });
      setProgressMap(next);
    };
    loadProgress();
  }, [enrollments]);

  const courseCount = enrollments?.length ?? 0;
  const certificatesCount =
    enrollments && enrollments.length > 0
      ? enrollments.reduce((count, enrollment) => {
          if (!enrollment.course) return count;
          const id = enrollment.course._id || enrollment.course.id || "";
          const progress = progressMap[id];
          return count + (progress?.status === "completed" ? 1 : 0);
        }, 0)
      : 0;
  const avgProgress =
    enrollments && enrollments.length > 0
      ? Math.round(
          enrollments.reduce((sum, enrollment) => {
            if (!enrollment.course) return sum;
            const id = enrollment.course._id || enrollment.course.id || "";
            const progress = progressMap[id];
            const value = progress ? (progress.status === "completed" ? 100 : 50) : 0;
            return sum + value;
          }, 0) / enrollments.length
        )
      : 0;
  const hoursLearned =
    enrollments && enrollments.length > 0
      ? Math.round(
          enrollments.reduce((sum, enrollment) => {
            if (!enrollment.course) return sum;
            const id = enrollment.course._id || enrollment.course.id || "";
            const progress = progressMap[id];
            const percent = progress ? (progress.status === "completed" ? 100 : 50) : 0;
            const durationHours = parseDurationToHours(enrollment.course.duration);
            return sum + (durationHours * percent) / 100;
          }, 0)
        )
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Student Dashboard – LearnHub LMS</title>
      </Helmet>
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground">My Learning</h1>
        <p className="mt-2 text-muted-foreground">Track your progress and continue learning</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={BookOpen} label="Enrolled Courses" value={courseCount.toString()} />
          <StatCard icon={Clock} label="Hours Learned" value={hoursLearned.toString()} />
          <StatCard icon={Award} label="Certificates" value={certificatesCount.toString()} />
          <StatCard icon={TrendingUp} label="Avg Progress" value={`${avgProgress}%`} />
        </div>

        <h2 className="mt-12 font-heading text-xl font-semibold text-foreground">Continue Learning</h2>
        <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {enrollments?.filter(e => e.course).map((enrollment) => {
            const course = enrollment.course;
            const id = course._id || course.id || "";
            const progress = progressMap[id];
            const percent = progress ? (progress.status === "completed" ? 100 : 50) : 0;
            return (
              <CourseCard
                key={id}
                compact
                course={mapApiCourseToCourse(course)}
                showProgress
                progress={percent}
              />
            );
          })}
          {!enrollments?.length && (
            <p className="text-sm text-muted-foreground">You are not enrolled in any courses yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
