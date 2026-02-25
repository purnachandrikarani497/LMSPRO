import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Users, DollarSign, BookOpen, TrendingUp, ListChecks, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { categories } from "@/lib/mockData";
import type { Course } from "@/lib/mockData";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiAdminEnrollment, ApiCourse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StatCardProps {
  icon: typeof BookOpen;
  label: string;
  value: string;
  trend?: string;
}

const mapApiCourseToCourse = (course: ApiCourse): Course => ({
  id: course._id || course.id || "",
  title: course.title,
  description: course.description,
  instructor: course.instructor || "Instructor",
  category: course.category || "General",
  price: course.price ?? 0,
  rating: course.rating ?? 0,
  students: course.students ?? 0,
  duration: course.duration || "",
  lessons: course.lessons?.length ?? 0,
  level: (course.level as Course["level"]) || "Beginner",
  image: course.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop"
});

const StatCard = ({ icon: Icon, label, value, trend }: StatCardProps) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-card">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
        {trend && <p className="mt-1 text-xs font-medium text-success">↑ {trend}</p>}
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15">
        <Icon className="h-5 w-5 text-secondary" />
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: apiCourses } = useQuery<ApiCourse[]>({
    queryKey: ["courses"],
    queryFn: () => api.getCourses()
  });

  const { data: adminEnrollments, isLoading: enrollmentsLoading } = useQuery<ApiAdminEnrollment[]>({
    queryKey: ["admin-enrollments"],
    queryFn: () => api.getAllEnrollments()
  });

  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", instructor: "", category: "Development",
    price: "", level: "Beginner" as Course["level"], image: "",
  });

  useEffect(() => {
    if (!apiCourses || apiCourses.length === 0) {
      setCoursesList([]);
      return;
    }
    setCoursesList(apiCourses.map(mapApiCourseToCourse));
  }, [apiCourses]);

  const resetForm = () => {
    setForm({ title: "", description: "", instructor: "", category: "Development", price: "", level: "Beginner", image: "" });
    setEditingId(null);
  };

  const handleEdit = (course: Course) => {
    setForm({
      title: course.title, description: course.description, instructor: course.instructor,
      category: course.category, price: String(course.price), level: course.level, image: course.image,
    });
    setEditingId(course.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setCoursesList((prev) => prev.filter((c) => c.id !== id));
  };

  const createMutation = useMutation<ApiCourse, Error, void>({
    mutationFn: () =>
      api.createCourse({
        title: form.title,
        description: form.description,
        thumbnail: form.image,
        instructor: form.instructor,
        category: form.category,
        price: Number(form.price),
        level: form.level
      }),
    onSuccess: (createdCourse) => {
      toast({ title: "Course created", description: "The course has been saved" });
      setCoursesList((prev) => [...prev, mapApiCourseToCourse(createdCourse)]);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      let description = "Please try again";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
            description = parsed.message;
          }
        } catch {
          description = "Please try again";
        }
      }
      toast({
        title: "Failed to create course",
        description,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation<ApiCourse, Error, void>({
    mutationFn: () =>
      api.updateCourse(editingId || "", {
        title: form.title,
        description: form.description,
        thumbnail: form.image,
        instructor: form.instructor,
        category: form.category,
        price: Number(form.price),
        level: form.level
      }),
    onSuccess: (updatedCourse) => {
      toast({ title: "Course updated", description: "Changes have been saved" });
      setCoursesList((prev) =>
        prev.map((course) =>
          course.id === (updatedCourse._id || updatedCourse.id || "")
            ? mapApiCourseToCourse(updatedCourse)
            : course
        )
      );
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Failed to update course",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCourse(id),
    onSuccess: () => {
      toast({ title: "Course deleted", description: "The course has been removed" });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: () => {
      toast({
        title: "Failed to delete course",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    const instructor = form.instructor.trim();
    const image = form.image.trim();
    const alphaRegex = /^[A-Za-z\s]+$/;
    const textRegex = /^[A-Za-z\s.,'-]+$/;

    if (!title) {
      toast({
        title: "Course title is required",
        description: "Please enter a course title (no spaces only)",
        variant: "destructive"
      });
      return;
    }
    if (title.length === 1) {
      toast({
        title: "Course title too short",
        description: "Title must be at least 2 characters",
        variant: "destructive"
      });
      return;
    }
    if (!alphaRegex.test(title) || title.length > 50) {
      toast({
        title: "Invalid course title",
        description: "Title must contain only letters and spaces, maximum 50 characters",
        variant: "destructive"
      });
      return;
    }

    if (!description) {
      toast({
        title: "Description is required",
        description: "Please enter a course description (no spaces only)",
        variant: "destructive"
      });
      return;
    }
    if (description.length === 1) {
      toast({
        title: "Description too short",
        description: "Description must be at least 2 characters",
        variant: "destructive"
      });
      return;
    }
    if (!textRegex.test(description) || description.length > 200) {
      toast({
        title: "Invalid description",
        description: "Description can include letters, spaces and basic punctuation, maximum 200 characters",
        variant: "destructive"
      });
      return;
    }

    if (!instructor) {
      toast({
        title: "Instructor name is required",
        description: "Please enter an instructor name (no spaces only)",
        variant: "destructive"
      });
      return;
    }
    if (instructor.length === 1) {
      toast({
        title: "Instructor name too short",
        description: "Instructor name must be at least 2 characters",
        variant: "destructive"
      });
      return;
    }
    if (!alphaRegex.test(instructor) || instructor.length > 30) {
      toast({
        title: "Invalid instructor name",
        description: "Instructor name must contain only letters and spaces, maximum 30 characters",
        variant: "destructive"
      });
      return;
    }

    const priceRaw = form.price.trim();
    const priceDigits = priceRaw.replace(/\D/g, "");
    if (!priceDigits) {
      toast({
        title: "Price is required",
        description: "Please enter a price greater than 0",
        variant: "destructive"
      });
      return;
    }
    if (priceDigits.length > 9) {
      toast({
        title: "Invalid price",
        description: "Price cannot exceed 9 digits",
        variant: "destructive"
      });
      return;
    }
    const priceNumber = Number(priceDigits);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      toast({
        title: "Invalid price",
        description: "Price must be a positive number",
        variant: "destructive"
      });
      return;
    }

    if (!image) {
      toast({
        title: "Image URL is required",
        description: "Please provide an image URL for the course (no spaces only)",
        variant: "destructive"
      });
      return;
    }
    if (image.length === 1) {
      toast({
        title: "Image URL too short",
        description: "Image URL must be at least 2 characters",
        variant: "destructive"
      });
      return;
    }

    setForm((prev) => ({ ...prev, price: priceDigits, title, description, instructor, image }));

    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const totalRevenue =
    adminEnrollments?.reduce((sum, enrollment) => sum + (enrollment.course?.price ?? 0), 0) ?? 0;

  const uniqueStudents =
    adminEnrollments && adminEnrollments.length > 0
      ? new Set(adminEnrollments.filter(e => e.student).map((enrollment) => enrollment.student._id)).size
      : 0;

  const avgRating =
    coursesList.length > 0
      ? (
          coursesList.reduce((sum, course) => sum + (course.rating ?? 0), 0) /
          coursesList.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin Dashboard – LearnHub LMS</title>
      </Helmet>
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Manage courses and track performance</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90">
                <Plus className="h-4 w-4" /> Add Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingId ? "Edit" : "New"} Course</DialogTitle>
                <DialogDescription>
                  Enter the course details below. All fields are required.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Course Title"
                  value={form.title}
                  maxLength={50}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.trim().length === 0 && value.length > 0) {
                      setForm({ ...form, title: "" });
                      return;
                    }
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      if (value.length === 50) {
                        toast({
                          title: "Title max length reached",
                          description: "Course title cannot exceed 50 characters",
                          variant: "destructive"
                        });
                      }
                      setForm({ ...form, title: value });
                    }
                  }}
                />
                <Textarea
                  placeholder="Description"
                  value={form.description}
                  maxLength={200}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.trim().length === 0 && value.length > 0) {
                      setForm({ ...form, description: "" });
                      return;
                    }
                    if (/^[A-Za-z\s.,'\n-]*$/.test(value)) {
                      if (value.length === 200) {
                        toast({
                          title: "Description max length reached",
                          description: "Description cannot exceed 200 characters",
                          variant: "destructive"
                        });
                      }
                      setForm({ ...form, description: value });
                    }
                  }}
                />
                <Input
                  placeholder="Instructor Name"
                  value={form.instructor}
                  maxLength={30}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.trim().length === 0 && value.length > 0) {
                      setForm({ ...form, instructor: "" });
                      return;
                    }
                    if (/^[A-Za-z\s]*$/.test(value)) {
                      if (value.length === 30) {
                        toast({
                          title: "Instructor name max length reached",
                          description: "Instructor name cannot exceed 30 characters",
                          variant: "destructive"
                        });
                      }
                      setForm({ ...form, instructor: value });
                    }
                  }}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as Course["level"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  placeholder="Price ($)"
                  value={form.price}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "");
                    if (digitsOnly.length <= 9) {
                      setForm({ ...form, price: digitsOnly });
                    }
                  }}
                />
                <Input
                  placeholder="Image URL"
                  value={form.image}
                  required
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.trim().length === 0 && value.length > 0) {
                      setForm({ ...form, image: "" });
                      return;
                    }
                    if (value.length === 200) {
                      toast({
                        title: "Image URL max length reached",
                        description: "Image URL cannot exceed 200 characters",
                        variant: "destructive"
                      });
                    }
                    setForm({ ...form, image: value });
                  }}
                />
                <Button
                  onClick={handleSubmit}
                  className="bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? "Save Changes" : "Create Course"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={BookOpen} label="Total Courses" value={String(coursesList.length)} />
          <StatCard icon={Users} label="Total Students" value={uniqueStudents.toString()} />
          <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
          <StatCard icon={TrendingUp} label="Avg Rating" value={avgRating} />
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Students</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden md:table-cell">Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coursesList.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img src={course.image} alt="" className="hidden h-10 w-14 rounded-md object-cover sm:block" />
                      <div>
                        <p className="font-medium text-card-foreground text-sm line-clamp-1">{course.title}</p>
                        <p className="text-xs text-muted-foreground">{course.instructor}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{course.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {course.students.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-semibold text-sm">${course.price}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    ⭐ {course.rating}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(course)}>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setCoursesList((prev) => prev.filter((c) => c.id !== course.id));
                          deleteMutation.mutate(course.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-12">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-secondary" />
                Completed Payments
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All courses where enrollment and payment have been completed.
              </p>
            </div>
          </div>
          {enrollmentsLoading && (
            <p className="mt-4 text-sm text-muted-foreground">Loading payment details...</p>
          )}
          {!enrollmentsLoading && (!adminEnrollments || adminEnrollments.length === 0) && (
            <p className="mt-4 text-sm text-muted-foreground">
              No completed payments found yet.
            </p>
          )}
          {adminEnrollments && adminEnrollments.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="hidden sm:table-cell">Student</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="hidden md:table-cell">Enrolled On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminEnrollments.map((enrollment) => (
                    <TableRow key={enrollment._id}>
                      <TableCell className="text-sm font-medium text-card-foreground">
                        {enrollment.course?.title || "Deleted Course"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {enrollment.student?.name || "Deleted Student"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {enrollment.student?.email || "-"}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        ${enrollment.course?.price?.toFixed(2) ?? "0.00"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {format(new Date(enrollment.createdAt), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/15">
            <ListChecks className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-card-foreground flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Tip
            </p>
            <p className="mt-1">
              Use this dashboard to manage courses. Lessons and quizzes can be attached to a course using backend tools or future admin screens.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
