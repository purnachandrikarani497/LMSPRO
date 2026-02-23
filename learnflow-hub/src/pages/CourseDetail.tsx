import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Clock, BookOpen, Users, Play, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { api, ApiCourse } from "@/lib/api";
import { Helmet } from "react-helmet-async";

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: apiCourse, isLoading } = useQuery<ApiCourse>({
    queryKey: ["course", id],
    queryFn: () => api.getCourse(id || ""),
    enabled: !!id
  });

  const course = apiCourse
    ? {
        id: apiCourse._id || apiCourse.id || "",
        title: apiCourse.title,
        description: apiCourse.description,
        instructor: apiCourse.instructor || "Instructor",
        category: apiCourse.category || "General",
        price: apiCourse.price ?? 0,
        rating: apiCourse.rating ?? 0,
        students: apiCourse.students ?? 0,
        duration: apiCourse.duration || "",
        lessons: apiCourse.lessons?.length ?? 0,
        level: (apiCourse.level as "Beginner" | "Intermediate" | "Advanced") || "Beginner",
        image: apiCourse.thumbnail || ""
      }
    : null;

  if (isLoading && !course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">Loading course...</h1>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">Course not found</h1>
          <Link to="/courses">
            <Button className="mt-4">Back to Courses</Button>
          </Link>
        </div>
      </div>
    );
  }

  const syllabus = [
    "Introduction & Setup",
    "Core Concepts & Fundamentals",
    "Building Your First Project",
    "Advanced Techniques",
    "Real-World Applications",
    "Final Project & Certification",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{course.title} – LearnHub Course</title>
        <meta name="description" content={course.description} />
        <meta property="og:title" content={`${course.title} – LearnHub Course`} />
        <meta property="og:description" content={course.description} />
        <meta property="og:type" content="article" />
        {course.image && <meta property="og:image" content={course.image} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Course",
              name: course.title,
              description: course.description
            })
          }}
        />
      </Helmet>
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-hero">
        <div className="container mx-auto px-4 py-14">
          <Link to="/courses" className="mb-6 inline-flex items-center gap-2 text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Courses
          </Link>
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Badge className="mb-4 bg-secondary/20 text-secondary border-secondary/30">{course.category}</Badge>
              <h1 className="font-heading text-3xl font-bold text-primary-foreground sm:text-4xl">
                {course.title}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-primary-foreground/70">{course.description}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-primary-foreground/60">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-secondary text-secondary" />
                  <span className="font-semibold text-primary-foreground">{course.rating}</span>
                  ({course.students.toLocaleString()} students)
                </span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{course.duration}</span>
                <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{course.lessons} lessons</span>
                <Badge variant="outline" className="border-primary-foreground/20 text-primary-foreground/60">{course.level}</Badge>
              </div>
              <p className="mt-4 text-sm text-primary-foreground/50">Created by <span className="text-secondary font-medium">{course.instructor}</span></p>
            </div>

            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card-hover">
                <img src={course.image} alt={course.title} className="aspect-video w-full object-cover" />
                <div className="p-6">
                  <div className="mb-4 text-3xl font-bold text-foreground">${course.price}</div>
                  <Button
                    size="lg"
                    className="w-full bg-gradient-gold text-base font-semibold text-primary shadow-gold hover:opacity-90"
                    onClick={() => navigate(`/course/${course.id}/payment`)}
                  >
                    Enroll Now
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => navigate(`/course/${course.id}/quiz`)}
                  >
                    Take Quiz
                  </Button>
                  <p className="mt-4 text-center text-xs text-muted-foreground">30-day money-back guarantee</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="font-heading text-2xl font-bold text-foreground">What You'll Learn</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Build real-world projects from scratch",
                "Master core fundamentals deeply",
                "Industry best practices & patterns",
                "Portfolio-ready work samples",
                "Problem-solving techniques",
                "Professional development workflow",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>

            <h2 className="mt-14 font-heading text-2xl font-bold text-foreground">Course Syllabus</h2>
            <div className="mt-6 space-y-3">
              {syllabus.map((item, i) => (
                <div key={item} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20 text-sm font-semibold text-secondary-foreground">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-card-foreground">{item}</span>
                  <Play className="ml-auto h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CourseDetail;
