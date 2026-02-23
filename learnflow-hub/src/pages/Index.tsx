import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CourseCard from "@/components/CourseCard";
import Footer from "@/components/Footer";
import { categories, type Course } from "@/lib/mockData";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiCourse } from "@/lib/api";

const Index = () => {
  const { data: apiCourses, isLoading } = useQuery<ApiCourse[]>({
    queryKey: ["courses"],
    queryFn: () => api.getCourses()
  });

  const featured: Course[] =
    (apiCourses || [])
      .slice(0, 3)
      .map((c): Course => ({
        id: c._id || c.id || "",
        title: c.title,
        description: c.description,
        instructor: c.instructor || "Instructor",
        category: c.category || "General",
        price: c.price ?? 0,
        rating: c.rating ?? 0,
        students: c.students ?? 0,
        duration: c.duration || "",
        lessons: c.lessons?.length ?? 0,
        level: (c.level as Course["level"]) || "Beginner",
        image: c.thumbnail || "",
        featured: false
      }));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>LearnHub LMS – Modern Online Learning Platform</title>
        <meta
          name="description"
          content="LearnHub is a modern Learning Management System for online courses, quizzes, certificates, and student progress tracking."
        />
        <meta property="og:title" content="LearnHub LMS – Modern Online Learning Platform" />
        <meta
          property="og:description"
          content="Deliver and manage online courses with quizzes, progress tracking, and certificates."
        />
        <meta property="og:type" content="website" />
      </Helmet>
      <Navbar />
      <HeroSection />

      {/* Categories */}
      <section className="container mx-auto px-4 py-20">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Explore Categories
          </h2>
          <p className="mt-3 text-muted-foreground">
            Find the perfect course for your learning journey
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat, i) => (
            <Link
              to="/courses"
              key={cat.name}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-card-hover hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="text-3xl">{cat.icon}</span>
              <span className="text-sm font-semibold text-card-foreground">{cat.name}</span>
              <span className="text-xs text-muted-foreground">{cat.count} courses</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Courses */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                Featured Courses
              </h2>
              <p className="mt-3 text-muted-foreground">
                Hand-picked from your latest published courses
              </p>
            </div>
            <Link to="/courses">
              <Button variant="ghost" className="hidden gap-2 text-secondary sm:flex">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading featured courses...</p>
          )}
          {!isLoading && featured.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No courses available yet. Create a course from the admin dashboard to see it here.
            </p>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((course, i) => (
              <div key={course.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <CourseCard course={course} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Why Learn with Us?
          </h2>
          <p className="mt-3 mb-12 text-muted-foreground">
            We provide everything you need to succeed
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Expert Instructors", desc: "Learn from industry professionals with real-world experience" },
            { title: "Lifetime Access", desc: "Access your courses forever, learn at your own pace" },
            { title: "Certificate of Completion", desc: "Earn certificates to showcase your achievements" },
            { title: "Project-Based Learning", desc: "Build real projects and portfolios as you learn" },
            { title: "Community Support", desc: "Join a global community of learners and mentors" },
            { title: "Money-Back Guarantee", desc: "30-day refund policy if you're not satisfied" },
          ].map((item, i) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-xl border border-border bg-card p-6 shadow-card animate-fade-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
              <div>
                <h3 className="font-heading text-base font-semibold text-card-foreground">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-hero py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl font-bold text-primary-foreground sm:text-4xl">
            Start Learning Today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/70">
            Join thousands of learners who are already building their future with LearnHub.
          </p>
          <Link to="/auth?tab=signup">
            <Button size="lg" className="mt-8 bg-gradient-gold px-10 text-base font-semibold text-primary shadow-gold hover:opacity-90">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
