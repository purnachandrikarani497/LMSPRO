import { ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiCourse } from "@/lib/api";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  const { data: courses } = useQuery<ApiCourse[]>({
    queryKey: ["courses"],
    queryFn: () => api.getCourses()
  });

  const totalCourses = courses?.length ?? 0;
  const totalStudents =
    courses && courses.length > 0
      ? courses.reduce((sum, course) => sum + (course.students ?? 0), 0)
      : 0;

  let totalInstructors = 0;
  let avgRating = 0;

  if (courses && courses.length > 0) {
    const instructorSet = new Set<string>();
    let ratingSum = 0;

    courses.forEach((course) => {
      if (course.instructor) {
        instructorSet.add(course.instructor);
      }
      ratingSum += course.rating ?? 0;
    });

    totalInstructors = instructorSet.size;
    avgRating = ratingSum / courses.length;
  }

  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-dark/95 via-navy/80 to-navy-dark/60" />
      </div>

      <div className="container relative mx-auto px-4 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold animate-fade-in">
            <Star className="h-3.5 w-3.5 fill-current" />
            {totalStudents > 0 ? `Trusted by ${totalStudents.toLocaleString()}+ learners worldwide` : "Trusted by learners worldwide"}
          </div>

          <h1 className="mb-6 font-heading text-4xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Unlock Your Potential with{" "}
            <span className="text-gradient-gold">World-Class</span>{" "}
            Learning
          </h1>

          <p className="mb-10 text-lg leading-relaxed text-primary-foreground/70 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {totalCourses > 0 ? `Access ${totalCourses}+ expert-led courses designed to help you master new skills,` : "Access expert-led courses designed to help you master new skills,"}
            advance your career, and achieve your goals.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/courses">
              <Button size="lg" className="gap-2 bg-gradient-gold px-8 text-base font-semibold text-primary shadow-gold hover:opacity-90">
                Explore Courses
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
