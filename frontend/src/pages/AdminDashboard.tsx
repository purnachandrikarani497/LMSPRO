import { useEffect, useRef, useState } from "react";
import { Plus, Edit, Trash2, Users, BookOpen, TrendingUp, Upload, Loader2, Settings, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { categories as staticCategories } from "@/lib/mockData";
import type { Course } from "@/lib/mockData";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiAdminEnrollment, ApiCategory, ApiCourse, getThumbnailSrc, mapApiCourseToCourse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";

interface StatCardProps {
  icon: typeof BookOpen;
  label: string;
  value: string;
  trend?: string;
  onClick?: () => void;
}


const StatCard = ({ icon: Icon, label, value, trend, onClick }: StatCardProps) => (
  <div
    className={`rounded-xl border border-border bg-card p-5 shadow-card ${onClick ? "cursor-pointer hover:border-secondary/50 hover:shadow-md transition-all" : ""}`}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
  >
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLDivElement>(null);
  const { data: apiCourses } = useQuery<ApiCourse[]>({
    queryKey: ["courses"],
    queryFn: () => api.getCourses()
  });

  const { data: adminEnrollments } = useQuery<ApiAdminEnrollment[]>({
    queryKey: ["admin-enrollments"],
    queryFn: () => api.getAllEnrollments()
  });

  const { data: apiCategories = [] } = useQuery<ApiCategory[]>({
    queryKey: ["categories"],
    queryFn: () => api.getCategories()
  });

  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"course" | "category" | "students" | "price" | "rating" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", instructor: "", category: "Development",
    price: "", level: "Beginner" as Course["level"], image: "",
  });
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [courseToDelete, setCourseToDelete] = useState<{ id: string; title: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const baseCategories = apiCategories.length > 0 ? apiCategories : staticCategories.map((c) => ({ _id: c.name, name: c.name, icon: c.icon }));
  const categoryOptions =
    form.category === "__new__" || baseCategories.some((c) => c.name === form.category)
      ? baseCategories
      : [...baseCategories, { _id: form.category, name: form.category }];

  useEffect(() => {
    if (!apiCourses || apiCourses.length === 0) {
      setCoursesList([]);
      return;
    }
    setCoursesList(apiCourses.map(mapApiCourseToCourse));
  }, [apiCourses]);

  useEffect(() => {
    return () => { previewBlobUrl && URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  const resetForm = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    const firstCat = baseCategories[0]?.name ?? "Development";
    setForm({ title: "", description: "", instructor: "", category: firstCat, price: "", level: "Beginner", image: "" });
    setNewCategoryInput("");
    setEditingId(null);
    setPreviewError(false);
    setFieldErrors({});
  };

  const fallbackImage = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop";

  const handleEdit = (course: Course) => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setForm({
      title: course.title, description: course.description, instructor: course.instructor,
      category: course.category, price: String(course.price), level: course.level, image: course.image,
    });
    setEditingId(course.id);
    setPreviewError(false);
    setDialogOpen(true);
  };

  const createMutation = useMutation<ApiCourse, Error, { title: string; description: string; thumbnail?: string; instructor: string; category: string; price: number; level: string; isPublished: boolean }>({
    mutationFn: (data) => api.createCourse(data),
    onSuccess: (createdCourse) => {
      toast({ title: "Course created", description: "The course has been saved" });
      setCoursesList((prev) => [...prev, mapApiCourseToCourse(createdCourse)]);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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

  const updateMutation = useMutation<ApiCourse, Error, { id: string; data: { title: string; description: string; thumbnail?: string; instructor: string; category: string; price: number; level: string; isPublished: boolean } }>({
    mutationFn: ({ id, data }) => api.updateCourse(id, data),
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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
      setCourseToDelete(null);
    },
    onError: () => {
      toast({
        title: "Failed to delete course",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const uniqueStudents =
    adminEnrollments && adminEnrollments.length > 0
      ? new Set(adminEnrollments.filter((e) => e.student).map((e) => e.student!._id)).size
      : 0;

  // Build a map of courseId -> actual enrollment count from real enrollment data
  const enrollmentCountByCourse = (adminEnrollments ?? []).reduce<Record<string, number>>((acc, e) => {
    if (!e.course) return acc;
    const courseId = typeof e.course === "object" ? (e.course._id || e.course.id) : String(e.course);
    if (courseId) acc[courseId] = (acc[courseId] ?? 0) + 1;
    return acc;
  }, {});

  const handleSubmit = () => {
    const title = form.title.trim();
    const description = form.description.trim();
    const instructor = form.instructor.trim();
    const image = form.image.trim();
    const alphaRegex = /^[A-Za-z\s]+$/;
    const textRegex = /^[A-Za-z0-9\s.,'\n-]+$/;

    const errors: Record<string, string> = {};

    if (!title) {
      errors.title = "Course title is required";
    } else if (title.length < 2) {
      errors.title = "Title must be at least 2 characters";
    } else if (!alphaRegex.test(title) || title.length > 50) {
      errors.title = "Title must contain only letters and spaces, max 50 characters";
    }

    if (!description) {
      errors.description = "Description is required";
    } else if (description.length < 2) {
      errors.description = "Description must be at least 2 characters";
    } else if (description.length > 500) {
      errors.description = "Description cannot exceed 500 characters";
    }

    if (!instructor) {
      errors.instructor = "Instructor name is required";
    } else if (instructor.length < 2) {
      errors.instructor = "Instructor name must be at least 2 characters";
    } else if (!alphaRegex.test(instructor) || instructor.length > 50) {
      errors.instructor = "Instructor name must contain only letters and spaces, max 50 characters";
    }

    const category = form.category === "__new__" ? newCategoryInput.trim() : form.category;
    if (!category) {
      errors.category = form.category === "__new__" ? "Please enter a new category name" : "Please select a category";
    } else if (category.length < 2) {
      errors.category = "Category must be at least 2 characters";
    } else if (!/^[A-Za-z\s]+$/.test(category) || category.length > 30) {
      errors.category = "Category must contain only letters and spaces, max 30 characters";
    }

    const priceRaw = form.price.trim();
    const priceDigits = priceRaw.replace(/\D/g, "");
    if (!priceDigits) {
      errors.price = "Price is required";
    } else if (priceDigits.length > 9) {
      errors.price = "Price cannot exceed 9 digits";
    } else {
      const priceNumber = Number(priceDigits);
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        errors.price = "Price must be a positive number";
      }
    }

    if (!image) {
      errors.image = "Thumbnail is required — upload an image or paste a URL";
    } else if (image.length < 2) {
      errors.image = "Image URL must be at least 2 characters";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const priceNumber = Number(priceDigits);

    setForm((prev) => ({ ...prev, price: priceDigits, title, description, instructor, image }));

    const mutationData = {
      title,
      description,
      thumbnail: image,
      instructor,
      category,
      price: priceNumber,
      level: form.level,
      isPublished: true
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: mutationData });
    } else {
      createMutation.mutate(mutationData);
    }
  };

  const avgRating =
    coursesList.length > 0
      ? (
          coursesList.reduce((sum, course) => sum + (course.rating ?? 0), 0) /
          coursesList.length
        ).toFixed(1)
      : "0";

  const handleSort = (col: "course" | "category" | "students" | "price" | "rating") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const filtered = coursesList.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.title || "").toLowerCase().includes(q) ||
      (c.instructor || "").toLowerCase().includes(q) ||
      (c.category || "").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortBy) return 0;
    let cmp = 0;
    switch (sortBy) {
      case "course":
        cmp = (a.title || "").localeCompare(b.title || "");
        break;
      case "category":
        cmp = (a.category || "").localeCompare(b.category || "");
        break;
      case "students":
        cmp = (enrollmentCountByCourse[a.id] ?? 0) - (enrollmentCountByCourse[b.id] ?? 0);
        break;
      case "price":
        cmp = (a.price ?? 0) - (b.price ?? 0);
        break;
      case "rating":
        cmp = (a.rating ?? 0) - (b.rating ?? 0);
        break;
      default:
        return 0;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin Dashboard – LearnHub LMS</title>
      </Helmet>
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
              <form
                className="grid gap-4 py-4"
                onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              >
                <div>
                  <Input
                    placeholder="Course Title"
                    value={form.title}
                    maxLength={50}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[a-zA-Z\s]*$/.test(value)) {
                        setForm({ ...form, title: value });
                        setFieldErrors((prev) => ({ ...prev, title: value.length === 50 ? "Course title cannot exceed 50 characters" : "" }));
                      } else {
                        setFieldErrors((prev) => ({ ...prev, title: "Course title can only contain letters and spaces" }));
                      }
                    }}
                  />
                  {fieldErrors.title && <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>}
                </div>
                <div>
                  <div className="relative">
                    <Textarea
                      placeholder="Description"
                      value={form.description}
                      maxLength={500}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 500) {
                          setForm({ ...form, description: value });
                          setFieldErrors((prev) => ({ ...prev, description: "" }));
                        }
                      }}
                    />
                    <span className={`absolute bottom-2 right-2 text-xs ${form.description.length >= 500 ? "text-destructive" : "text-muted-foreground"}`}>
                      {form.description.length}/500
                    </span>
                  </div>
                  {fieldErrors.description && <p className="mt-1 text-xs text-destructive">{fieldErrors.description}</p>}
                </div>
                <div>
                  <Input
                    placeholder="Instructor Name"
                    value={form.instructor}
                    maxLength={50}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[a-zA-Z\s]*$/.test(value)) {
                        setForm({ ...form, instructor: value });
                        setFieldErrors((prev) => ({ ...prev, instructor: value.length === 50 ? "Instructor name cannot exceed 50 characters" : "" }));
                      } else {
                        setFieldErrors((prev) => ({ ...prev, instructor: "Instructor name can only contain letters and spaces" }));
                      }
                    }}
                  />
                  {fieldErrors.instructor && <p className="mt-1 text-xs text-destructive">{fieldErrors.instructor}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Select
                      value={form.category}
                      onValueChange={(v) => {
                        setForm({ ...form, category: v });
                        setFieldErrors((prev) => ({ ...prev, category: "" }));
                        if (v !== "__new__") setNewCategoryInput("");
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent className="max-h-48 overflow-y-auto">
                        {categoryOptions.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.icon ? `${c.icon} ` : ""}{c.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Add new category</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.category === "__new__" && (
                      <Input
                        placeholder="Enter new category name"
                        value={newCategoryInput}
                        maxLength={30}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^[A-Za-z\s]*$/.test(v)) {
                            setNewCategoryInput(v);
                            setFieldErrors((prev) => ({ ...prev, category: "" }));
                          }
                        }}
                        className="mt-1"
                      />
                    )}
                    {fieldErrors.category && <p className="mt-1 text-xs text-destructive">{fieldErrors.category}</p>}
                  </div>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v as Course["level"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Price (₹)"
                    className="input-no-spinner"
                    value={form.price}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length > 9) {
                        setFieldErrors((prev) => ({ ...prev, price: "Price cannot exceed 9 digits" }));
                        return;
                      }
                      setForm({ ...form, price: value });
                      setFieldErrors((prev) => ({ ...prev, price: "" }));
                    }}
                  />
                  {fieldErrors.price && <p className="mt-1 text-xs text-destructive">{fieldErrors.price}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Course thumbnail</label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      id="thumbnail-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
                          return;
                        }
                        if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                        const blobUrl = URL.createObjectURL(file);
                        setPreviewBlobUrl(blobUrl);
                        setPreviewError(false);
                        setUploading(true);
                        try {
                          const { url, key } = await api.uploadThumbnail(file);
                          setForm((prev) => ({ ...prev, image: key || url }));
                          setFieldErrors((prev) => ({ ...prev, image: "" }));
                          toast({ title: "Image uploaded", description: "Thumbnail ready" });
                        } catch (err) {
                          URL.revokeObjectURL(blobUrl);
                          setPreviewBlobUrl(null);
                          toast({
                            title: "Upload failed",
                            description: err instanceof Error ? err.message : "Please try again",
                            variant: "destructive"
                          });
                        } finally {
                          setUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 shrink-0"
                      onClick={() => document.getElementById("thumbnail-upload")?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : "Upload image"}
                    </Button>

                  </div>
                  {fieldErrors.image && <p className="mt-1 text-xs text-destructive">{fieldErrors.image}</p>}
                  {(form.image || previewBlobUrl) && (
                    <div className="mt-1 flex h-24 w-40 items-center justify-center overflow-hidden rounded border border-border bg-muted/50">
                      {previewError && !previewBlobUrl ? (
                        <p className="px-2 text-center text-xs text-muted-foreground">
                          Could not load preview. Use &quot;Upload image&quot; or paste a valid URL.
                        </p>
                      ) : (
                        <img
                          src={previewBlobUrl ? previewBlobUrl : getThumbnailSrc(form.image) || form.image}
                          alt="Preview"
                          className="h-full w-full object-cover"
                          onLoad={() => setPreviewError(false)}
                          onError={(e) => {
                            if (!previewBlobUrl) {
                              setPreviewError(true);
                              // Try to use a fallback placeholder if the URL/key fails
                              (e.target as HTMLImageElement).src = fallbackImage;
                            }
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? "Save Changes" : "Create Course"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={BookOpen}
            label="Total Courses"
            value={String(coursesList.length)}
            onClick={() => {
              setSearchQuery("");
              setSortBy(null);
              setPage(1);
              setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
          />
          <StatCard
            icon={Users}
            label="Total Students"
            value={uniqueStudents.toString()}
            onClick={() => navigate("/admin/users")}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Rating"
            value={avgRating}
            onClick={() => {
              setSortBy("rating");
              setSortDir("desc");
              setPage(1);
              setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
          />
        </div>

        <div className="mt-10 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, instructor, or category..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {coursesList.length} courses
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card" ref={tableRef}>
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("course")}
                    className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Course
                    {sortBy === "course" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort("category")}
                    className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Category
                    {sortBy === "category" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("students")}
                    className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Students
                    {sortBy === "students" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("price")}
                    className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Price
                    {sortBy === "price" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort("rating")}
                    className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
                  >
                    Rating
                    {sortBy === "rating" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {filtered.length === 0 && searchQuery.trim()
                      ? "No courses match your search. Try a different term."
                      : "No courses yet. Add your first course above."}
                  </TableCell>
                </TableRow>
              ) : paginated.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="hidden h-10 w-14 overflow-hidden rounded-md bg-muted sm:block">
                        <img
                          src={getThumbnailSrc(course.image) || course.image || ""}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackImage;
                            (e.target as HTMLImageElement).style.opacity = "0.5";
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground text-sm line-clamp-1">{course.title}</p>
                        <p className="text-xs text-muted-foreground">{course.instructor}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">{course.category}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
                    {(enrollmentCountByCourse[course.id] ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-semibold text-sm">{formatPrice(course.price)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                    ⭐ {(() => { const r = course.rating ?? 0; return r === 0 ? "0" : r.toFixed(1); })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/course/${course.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Manage lessons">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(course)}>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCourseToDelete({ id: course.id, title: course.title })}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{courseToDelete?.title}&quot;? This will remove the course and related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => courseToDelete && deleteMutation.mutate(courseToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;
