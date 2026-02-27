import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CourseCard from "@/components/CourseCard";
import { categories, type Course } from "@/lib/mockData";
import { useQuery } from "@tanstack/react-query";
import { api, ApiCourse, mapApiCourseToCourse } from "@/lib/api";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

const Courses = () => {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [level, setLevel] = useState("all");

  useEffect(() => {
    const param = searchParams.get("category") || "all";
    setCategory(param);
  }, [searchParams]);

  const { data: apiCourses, isLoading } = useQuery<ApiCourse[]>({
    queryKey: ["courses"],
    queryFn: () => api.getCourses()
  });

  const sourceCourses: Course[] = (apiCourses || []).map(mapApiCourseToCourse);

  const filtered = sourceCourses.filter((c) => {
    const title = c.title || "";
    const instructor = c.instructor || "";
    const matchSearch = title.toLowerCase().includes(search.toLowerCase()) ||
      instructor.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || c.category === category;
    const matchLevel = level === "all" || c.level === level;
    return matchSearch && matchCat && matchLevel;
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>All Courses – LearnHub LMS</title>
        <meta
          name="description"
          content="Browse all available courses on LearnHub LMS across development, design, marketing, business and more."
        />
        <meta property="og:title" content="All Courses – LearnHub LMS" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">All Courses</h1>
        <p className="mt-2 text-muted-foreground">Browse our full catalog of expert-led courses</p>

        {/* Filters */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          {isLoading && sourceCourses.length === 0 ? "Loading courses..." : `${filtered.length} courses found`}
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((course, i) => (
            <div key={course.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <CourseCard course={course} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            No courses found. Try adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;
