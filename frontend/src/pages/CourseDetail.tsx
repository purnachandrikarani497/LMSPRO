import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Clock, BookOpen, Users, CheckCircle, ArrowLeft, ChevronDown, FileText, Play, Pause, CheckCircle2, AlertCircle, ChevronRight, Edit, Trophy, Share2, Trash2, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiCourse, ApiEnrollment, ApiProgress, ApiWatchTimestamps, ApiNoteEntry, getThumbnailSrc, getSecureVideoSrc, getSecureStreamUrl, mapApiCourseToCourse, getUserRoleFromToken, getUserIdFromToken } from "@/lib/api";
import { SecureVideoPlayer } from "@/components/SecureVideoPlayer";
import { formatPrice } from "@/lib/utils";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";

const tabs = ["Overview", "Notes", "Announcements", "Reviews"];

type NoteWithLesson = ApiNoteEntry & { lessonId: string; lessonTitle: string; index: number };

function formatWatchTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parse "M:SS" or "H:MM:SS" to seconds */
function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration?.trim()) return 0;
  const parts = duration.trim().split(":").map((p) => parseInt(p.replace(/\D/g, ""), 10));
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
  if (parts.length >= 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 1) return parts[0] || 0;
  return 0;
}

/** Format total seconds as "X hr Y min" or "X min" for display */
function formatTotalDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
}

const CourseDetail = () => {
  const { id, courseId, lessonId } = useParams<{ id?: string; courseId?: string; lessonId?: string }>();
  const courseParam = id ?? courseId ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [videoError, setVideoError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const userRole = getUserRoleFromToken();

  useEffect(() => {
    setVideoError(null);
  }, [lessonId]);
  const [activeTab, setActiveTab] = useState("Overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [note, setNote] = useState("");
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [notesFilter, setNotesFilter] = useState<"current" | "all">("current");
  const [notesSort, setNotesSort] = useState<"recent" | "oldest">("recent");
  const [editingNote, setEditingNote] = useState<{ lessonId: string; index: number } | null>(null);
  const seekToRef = useRef<((seconds: number) => void) | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const { data: apiCourse, isLoading, error } = useQuery<ApiCourse>({
    queryKey: ["course", courseParam],
    queryFn: () => api.getCourse(courseParam),
    enabled: !!courseParam
  });

  const currentUserId = getUserIdFromToken();
  const userReview = useMemo(() => {
    if (!apiCourse?.reviews || !currentUserId) return null;
    return apiCourse.reviews.find(r => (r.user?._id || r.user) === currentUserId);
  }, [apiCourse?.reviews, currentUserId]);

  const hasToken = typeof window !== "undefined" && !!window.localStorage.getItem("lms_token");

  const reviewMutation = useMutation({
    mutationFn: (data: { rating: number; comment: string }) => api.submitReview(courseParam, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['course', courseParam], data);
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      setRating(0);
      setReview("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit review",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (rating > 0 && review.trim() !== "") {
      reviewMutation.mutate({ rating, comment: review });
    } else {
      toast({
        title: "Incomplete review",
        description: "Please provide a rating and a review before submitting.",
        variant: "destructive",
      });
    }
  };

  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<ApiEnrollment[]>({
    queryKey: ["enrollments"],
    queryFn: () => api.getEnrollments(),
    enabled: hasToken && !!courseParam,
    retry: false
  });

  const { data: progress } = useQuery<ApiProgress>({
    queryKey: ["progress", courseParam],
    queryFn: () => api.getProgress(courseParam),
    enabled: hasToken && !!courseParam && (enrollments?.some((e) => (e.course?._id || e.course?.id) === courseParam) ?? false),
    retry: false
  });

  const { data: watchData, isFetched: watchDataFetched } = useQuery<ApiWatchTimestamps>({
    queryKey: ["watchTimestamps", courseParam],
    queryFn: () => api.getWatchTimestamps(courseParam),
    enabled: hasToken && !!courseParam && (enrollments?.some((e) => (e.course?._id || e.course?.id) === courseParam) ?? false),
    retry: false
  });

  const watchTimestamps = watchData?.timestamps ?? {};
  const watchDurations = watchData?.durations ?? {};
  const watchNotes = useMemo(() => watchData?.notes ?? {}, [watchData?.notes]);

  const saveTimestampRef = useRef<ReturnType<typeof setTimeout>>();
  const handleTimeReport = useCallback((currentTime: number, videoDuration: number) => {
    setCurrentVideoTime(currentTime);
    if (!courseParam || !lessonId) return;
    queryClient.setQueryData<ApiWatchTimestamps>(["watchTimestamps", courseParam], (old) => ({
      ...old,
      timestamps: { ...(old?.timestamps ?? {}), [lessonId]: currentTime },
      durations: { ...(old?.durations ?? {}), [lessonId]: videoDuration },
      notes: old?.notes ?? {}
    }));
    if (saveTimestampRef.current) clearTimeout(saveTimestampRef.current);
    saveTimestampRef.current = setTimeout(() => {
      api.saveWatchTimestamp(courseParam, lessonId, currentTime, videoDuration)
        .then((res) => {
          if (res?.autoCompleted) {
            queryClient.invalidateQueries({ queryKey: ["progress", courseParam] });
          }
        })
        .catch(() => {});
    }, 300);
  }, [courseParam, lessonId, queryClient]);

  useEffect(() => {
    return () => {
      if (saveTimestampRef.current) clearTimeout(saveTimestampRef.current);
    };
  }, []);

  const completeMutation = useMutation({
    mutationFn: () => api.completeLesson(courseParam, lessonId || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", courseParam] });
      toast({ title: "Lesson completed", description: "Progress has been updated" });
    },
    onError: () => {
      toast({
        title: "Unable to update progress",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const isEnrolled = enrollments?.some((e) => (e.course?._id || e.course?.id) === courseParam) ?? false;
  const completedLessonIds = new Set(progress?.lessonsCompleted ?? []);

  const isLessonComplete = useCallback(
    (lesson: { _id?: string }) => {
      const lid = lesson._id;
      if (!lid) return false;
      if (completedLessonIds.has(lid)) return true;
      const dur = watchDurations[lid];
      const ts = watchTimestamps[lid];
      return typeof dur === "number" && dur > 0 && typeof ts === "number" && ts / dur >= 0.9;
    },
    [completedLessonIds, watchDurations, watchTimestamps]
  );

  const course = apiCourse ? mapApiCourseToCourse(apiCourse) : null;
  const lessons = useMemo(() => course?.lessonItems ?? [], [course?.lessonItems]);
  const selectedLesson = lessonId ? lessons.find((l) => l._id === lessonId) ?? lessons[0] : null;
  const selectedIndex = selectedLesson ? lessons.findIndex((l) => l._id === selectedLesson._id) : -1;
  const activeNoteLessonId = selectedLesson?._id ?? lessonId;

  useEffect(() => {
    setNote("");
    setEditingNote(null);
  }, [activeNoteLessonId]);

  // When opening course without a lesson, auto-navigate to last watched lesson (or first)
  useEffect(() => {
    if (lessonId || !courseParam || !isEnrolled || !course || lessons.length === 0) return;
    if (isEnrolled && !watchDataFetched) return;
    const lastWatched = lessons.reduce<{ lesson: (typeof lessons)[0]; index: number } | null>((best, lesson, i) => {
      const lid = lesson._id;
      if (!lid) return best;
      const ts = watchTimestamps[lid] ?? 0;
      const dur = watchDurations[lid] ?? parseDurationToSeconds(lesson.duration);
      const completed = completedLessonIds.has(lid);
      const inProgress = ts > 0 && (dur <= 0 || ts < dur * 0.9);
      if (!inProgress && completed) return best;
      if (inProgress && (!best || i > best.index)) return { lesson, index: i };
      if (!best && !completed) return { lesson, index: i };
      return best;
    }, null);
    const target = lastWatched?.lesson ?? lessons[0];
    if (target?._id) navigate(`/course/${courseParam}/lesson/${target._id}`, { replace: true });
  }, [lessonId, courseParam, isEnrolled, course, lessons, watchTimestamps, watchDurations, completedLessonIds, navigate, watchDataFetched]);

  const allNotesFlattened = useMemo((): NoteWithLesson[] => {
    const out: NoteWithLesson[] = [];
    Object.entries(watchNotes).forEach(([lid, arr]) => {
      const raw = Array.isArray(arr) ? arr : (typeof arr === "string" && arr ? [{ text: arr, createdAt: "" }] : []);
      const lesson = lessons.find((l) => l._id === lid);
      raw.forEach((entry, i) => {
        out.push({
          ...entry,
          lessonId: lid,
          lessonTitle: lesson?.title ?? "Lesson",
          index: i,
          videoTimestamp: entry.videoTimestamp ?? 0
        });
      });
    });
    return out.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return notesSort === "recent" ? tb - ta : ta - tb;
    });
  }, [watchNotes, lessons, notesSort]);

  const displayedNotes = useMemo((): NoteWithLesson[] => {
    if (notesFilter === "all") return allNotesFlattened;
    return allNotesFlattened.filter((n) => n.lessonId === activeNoteLessonId);
  }, [allNotesFlattened, notesFilter, activeNoteLessonId]);

  const savedNotesForLesson = useMemo((): ApiNoteEntry[] => {
    if (!activeNoteLessonId) return [];
    const raw = watchNotes[activeNoteLessonId];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw) return [{ text: raw, createdAt: "", videoTimestamp: 0 }];
    return [];
  }, [activeNoteLessonId, watchNotes]);

  const saveNoteMutation = useMutation({
    mutationFn: ({ courseId, lessonId, note, videoTimestamp }: { courseId: string; lessonId: string; note: string; videoTimestamp?: number }) =>
      api.saveNote(courseId, lessonId, note, videoTimestamp),
    onSuccess: (data, { courseId, lessonId }) => {
      setNote("");
      setEditingNote(null);
      queryClient.setQueryData<ApiWatchTimestamps>(["watchTimestamps", courseId], (old) => ({
        timestamps: old?.timestamps ?? {},
        durations: old?.durations ?? {},
        notes: { ...(old?.notes ?? {}), [lessonId]: data.note ?? old?.notes?.[lessonId] ?? [] }
      }));
      toast({ title: "Note saved", description: "Your note has been saved successfully." });
    },
    onError: () => {
      toast({ title: "Failed to save note", description: "Please try again.", variant: "destructive" });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ courseId, lessonId, noteIndex, note }: { courseId: string; lessonId: string; noteIndex: number; note: string }) =>
      api.updateNote(courseId, lessonId, noteIndex, note),
    onSuccess: (data, { courseId, lessonId }) => {
      setNote("");
      setEditingNote(null);
      queryClient.setQueryData<ApiWatchTimestamps>(["watchTimestamps", courseId], (old) => ({
        timestamps: old?.timestamps ?? {},
        durations: old?.durations ?? {},
        notes: { ...(old?.notes ?? {}), [lessonId]: data.note ?? old?.notes?.[lessonId] ?? [] }
      }));
      toast({ title: "Note updated", description: "Your note has been updated." });
    },
    onError: () => {
      toast({ title: "Failed to update note", description: "Please try again.", variant: "destructive" });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ courseId, lessonId, noteIndex }: { courseId: string; lessonId: string; noteIndex: number }) =>
      api.deleteNote(courseId, lessonId, noteIndex),
    onSuccess: (data, { courseId, lessonId }) => {
      queryClient.setQueryData<ApiWatchTimestamps>(["watchTimestamps", courseId], (old) => ({
        timestamps: old?.timestamps ?? {},
        durations: old?.durations ?? {},
        notes: { ...(old?.notes ?? {}), [lessonId]: data.note ?? [] }
      }));
      toast({ title: "Note deleted", description: "Your note has been removed." });
    },
    onError: () => {
      toast({ title: "Failed to delete note", description: "Please try again.", variant: "destructive" });
    }
  });

  const handleSaveNote = () => {
    if (editingNote) {
      if (courseParam) {
        updateNoteMutation.mutate({
          courseId: courseParam,
          lessonId: editingNote.lessonId,
          noteIndex: editingNote.index,
          note
        });
      }
    } else if (courseParam && activeNoteLessonId) {
      saveNoteMutation.mutate({
        courseId: courseParam,
        lessonId: activeNoteLessonId,
        note,
        videoTimestamp: Math.round(currentVideoTime)
      });
    } else {
      toast({ title: "Select a lesson", description: "Please select a lesson to add notes.", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setNote("");
    setEditingNote(null);
  };
  const prevLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex + 1 < lessons.length ? lessons[selectedIndex + 1] : null;
  const [autoplay, setAutoplay] = useState(false);

  // Get sections if available, otherwise create default section from lessons
  const sections = useMemo(() => 
    apiCourse?.sections && apiCourse.sections.length > 0
      ? apiCourse.sections
      : lessons.length > 0
      ? [{ title: "Course Content", lessons }]
      : [],
    [apiCourse?.sections, lessons]
  );

  // Expand first section by default + section containing the active lesson
  useEffect(() => {
    if (sections.length > 0) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        if (next.size === 0) next.add(sections[0].title);
        if (selectedLesson) {
          const activeSection = sections.find(s =>
            s.lessons?.some(l => l._id === selectedLesson._id)
          );
          if (activeSection) next.add(activeSection.title);
        }
        return next;
      });
    }
  }, [sections, selectedLesson]);

  // Sum actual lesson durations from all sections — never use course.duration (stored/manual field)
  const totalDuration = (course?.lessonItems ?? []).reduce((acc, l) => acc + parseDurationToSeconds(l.duration), 0);
  const totalHours = formatTotalDuration(totalDuration);

  const { totalCourseSeconds, watchTimeSeconds, progressPercent } = useMemo(() => {
    const lessons = course?.lessonItems ?? [];
    let total = 0;
    let watchTime = 0;
    for (const l of lessons) {
      const lid = l._id;
      const durationFromApi = lid ? (watchDurations[lid] ?? 0) : 0;
      const durationFromLesson = parseDurationToSeconds(l.duration);
      const lessonDuration = durationFromApi > 0 ? durationFromApi : durationFromLesson;
      if (lessonDuration <= 0) continue;
      total += lessonDuration;
      const ts = lid ? (watchTimestamps[lid] ?? 0) : 0;
      watchTime += Math.min(ts, lessonDuration);
    }
    const pct = total > 0 ? Math.min(100, Math.round((watchTime / total) * 100)) : 0;
    return { totalCourseSeconds: total, watchTimeSeconds: watchTime, progressPercent: pct };
  }, [course?.lessonItems, watchTimestamps, watchDurations]);

  if (isLoading && !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Course not found</h1>
          <p className="mt-2 text-gray-600">This course may not exist or is no longer available.</p>
          <Link to="/courses">
            <Button className="mt-4">Back to Courses</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Admin view
  if (userRole === "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <Link
            to="/courses"
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Courses
          </Link>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
                <p className="mt-2 text-sm font-medium text-gray-500">{course.subtitle}</p>
                <p className="mt-2 text-gray-600">{course.description}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <span className="text-gray-600">
                    <strong>Instructor:</strong> {course.instructor}
                  </span>
                  <span className="text-gray-600">
                    <strong>Category:</strong> {course.category}
                  </span>
                  <span className="text-gray-600">
                    <strong>Level:</strong> {course.level}
                  </span>
                  <span className="text-gray-600">
                    <strong>Price:</strong> {formatPrice(course.price)}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/admin/course/${course.id}`)}
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                <Edit className="h-4 w-4" />
                Edit Course
              </Button>
            </div>

            <div className="mt-8 border-t pt-6">
              <h2 className="text-lg font-bold text-gray-900">Course Content</h2>
              <p className="mt-2 text-sm text-gray-600">{course.lessons} lessons</p>
              <div className="mt-4 space-y-3">
                {sections && sections.length > 0 ? (
                  sections.map((section) => (
                    <div key={section.title} className="rounded border border-gray-200 p-3">
                      <p className="font-medium text-gray-900">{section.title}</p>
                      <p className="mt-1 text-xs text-gray-400">{section.lessons?.length || 0} lessons</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No lessons added yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Non-enrolled: show course detail landing page (only after we've confirmed enrollment status)
  const enrollmentKnown = !enrollmentsLoading || enrollments !== undefined;
  if (enrollmentKnown && !isEnrolled && !lessonId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Helmet>
          <title>{course.title} – LearnHub Course</title>
          <meta name="description" content={course.description} />
          <meta property="og:title" content={`${course.title} – LearnHub Course`} />
          <meta property="og:description" content={course.description} />
          <meta property="og:type" content="article" />
          {course.image && (
            <meta property="og:image" content={getThumbnailSrc(course.image) || course.image} />
          )}
        </Helmet>

        <div className="relative">
          {/* Hero background overlay */}
          <div className="absolute inset-x-0 top-0 bg-gray-900 h-[580px] lg:h-[500px]" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="grid gap-8 lg:grid-cols-3 py-10 lg:py-16">
              {/* Hero Section (Left) */}
              <div className="lg:col-span-2 space-y-4 text-white">
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Courses
                </Link>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-500/90">
                  <span className="hover:underline cursor-pointer">{course.category}</span>
                  <ChevronRight className="h-3 w-3 text-gray-600" />
                  <span className="hover:underline cursor-pointer">{course.level}</span>
                  <ChevronRight className="h-3 w-3 text-gray-600" />
                  <span className="text-gray-400">{course.title.split(" ").slice(0, 3).join(" ")}...</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-bold sm:text-4xl leading-tight">{course.title}</h1>
                  {course.rating >= 4.7 && (
                    <span className="inline-block rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500 ring-1 ring-inset ring-amber-500/20">
                      Bestseller
                    </span>
                  )}
                </div>
                <p className="text-lg text-gray-300 leading-relaxed max-w-3xl">{course.subtitle || course.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold text-amber-400">{course.rating.toFixed(1)}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.floor(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-500"}`}
                        />
                      ))}
                    </div>
                    <span className="text-gray-400">({(course.ratingCount || 0).toLocaleString()} ratings)</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  {course.instructor && <span>Created by <span className="text-amber-400 underline">{course.instructor}</span></span>}
                  {course.category && <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {course.category}</span>}
                  {course.level && <span className="capitalize">{course.level}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Last updated {new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })}</span>
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> English [Auto], Hindi [Auto]</span>
                </div>

                {/* Summary Bar */}
                <div className="mt-8 flex flex-wrap items-stretch gap-px overflow-hidden rounded-lg bg-gray-800/40 backdrop-blur-sm border border-gray-700/50">
                  <div className="flex flex-1 items-center gap-4 p-4 min-w-[240px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/20">
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Premium Selection</p>
                      <p className="text-xs text-gray-400">One of our top-rated courses for career growth</p>
                    </div>
                  </div>
                  <div className="hidden sm:block w-px bg-gray-700/50" />
                  <div className="flex flex-col justify-center p-4 px-6 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-white">{course.rating.toFixed(1)}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < Math.floor(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-600"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap">{course.ratingCount ? course.ratingCount.toLocaleString() : 0} ratings</p>
                  </div>
                </div>
              </div>

              {/* Sidebar Section (Right) */}
              <div className="lg:col-span-1 lg:row-span-2">
                <div className="lg:sticky lg:top-24 z-20">
                  <div className="overflow-hidden rounded-lg bg-white shadow-lg border border-gray-200">
                    {course.image && (
                      <img
                        src={getThumbnailSrc(course.image) || course.image}
                        alt={course.title}
                        className="aspect-video w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="p-6 space-y-4">
                      <div className="text-3xl font-bold text-gray-900">{formatPrice(course.price)}</div>
                      <Button
                        size="lg"
                        className="w-full bg-amber-500 font-semibold text-white hover:bg-amber-600 text-lg py-6"
                        onClick={() => navigate(`/course/${course.id}/payment`)}
                      >
                        Enroll now
                      </Button>
                      <p className="text-center text-xs text-gray-500">30-day money-back guarantee</p>
                      {course.description && (
                        <div className="mt-2 text-sm text-gray-700 bg-gray-50/50 p-3 rounded-md border border-gray-100 italic">
                          <p className="whitespace-pre-wrap">{course.description}</p>
                        </div>
                      )}
                      <div className="border-t pt-4 space-y-2 text-sm text-gray-600">
                        <p className="font-semibold text-gray-900">This course includes:</p>
                        <p className="flex items-center gap-2"><Play className="h-4 w-4 text-gray-400" /> {totalHours} of video content</p>
                        <p className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-gray-400" /> {course.lessons} lessons</p>
                        <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-gray-400" /> Certificate of completion</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Section (Left) */}
              <div className="lg:col-span-2 space-y-10 pt-4">
                {/* Course content sections */}
                {sections.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Course content</h2>
                    <p className="text-sm text-gray-500 mb-3">
                      {sections.length} sections &middot; {lessons.length} lessons &middot; {totalHours} total length
                    </p>
                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      {sections.map((section) => {
                        const isExpanded = expandedSections.has(section.title);
                        const sectionLessons = section.lessons || [];
                        return (
                          <div key={section.title} className="border-b border-gray-200 last:border-b-0">
                            <button
                              onClick={() => {
                                setExpandedSections(prev => {
                                  const next = new Set(prev);
                                  if (next.has(section.title)) next.delete(section.title);
                                  else next.add(section.title);
                                  return next;
                                });
                              }}
                              className="w-full flex items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                <p className="font-bold text-gray-900 text-sm">{section.title}</p>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">{sectionLessons.length} lessons</span>
                            </button>
                            {isExpanded && (
                              <div className="divide-y divide-gray-100">
                                {sectionLessons.map((lesson, i) => (
                                  <div key={lesson._id || i} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600">
                                    <Play className="h-4 w-4 flex-shrink-0 text-gray-400" />
                                    <span className="flex-1">{lesson.title}</span>
                                    {lesson.duration && <span className="text-xs text-gray-400">{lesson.duration}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* About */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">About this course</h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{course.description}</p>
                </div>

                {/* Requirements */}
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Requirements</h2>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> A computer with internet access.</li>
                    <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> Basic understanding of how to use a camera.</li>
                    <li className="flex items-start gap-2"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> No prior photography experience is needed. You will learn everything from scratch.</li>
                  </ul>
                </div>

                {/* Instructor */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Instructor</h2>
                  <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-6">
                    <img src="https://i.pravatar.cc/150?u=sarahjohnson" alt="Sarah Johnson" className="h-24 w-24 rounded-full object-cover" />
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{course.instructor}</h3>
                      <p className="text-sm text-amber-600">Lead Photographer & Educator</p>
                      <p className="mt-2 text-sm text-gray-600">
                        Sarah is an award-winning photographer with over 15 years of experience. She has a passion for teaching and has helped thousands of students master the art of photography.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{selectedLesson ? `${selectedLesson.title} – ` : ""}{course.title} – LearnHub Course</title>
        <meta name="description" content={course.description} />
        <meta property="og:title" content={`${course.title} – LearnHub Course`} />
        <meta property="og:description" content={course.description} />
        <meta property="og:type" content="article" />
        {course.image && (
          <meta property="og:image" content={getThumbnailSrc(course.image) || course.image} />
        )}
      </Helmet>

      {/* Course top navbar */}
      <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-border/50 bg-card/80 backdrop-blur-xl px-4 py-2">
        <Link to="/dashboard" className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Back to My Learning">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-gold">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="font-heading text-base font-bold text-foreground hidden sm:inline">LearnHub</span>
        </Link>
        <span className="mx-1 text-border">|</span>
        <h1 className="truncate text-sm font-semibold text-foreground flex-1 min-w-0">{course.title}</h1>
        {isEnrolled && (
          <div className="ml-auto hidden items-center gap-4 md:flex flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("Reviews")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Star className="h-4 w-4" />
              Leave a rating
            </button>
            <div className="relative group">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Trophy className="h-4 w-4" />
                Your progress
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 rounded-lg border border-border bg-card p-3 shadow-lg min-w-[120px]">
                <p className="text-sm font-medium text-foreground">Progress</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs font-medium text-amber-600 mt-1">{progressPercent}% complete</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {typeof navigator !== "undefined" && navigator.share && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: course?.title ?? "Course",
                          url: window.location.href,
                          text: `Check out ${course?.title ?? "this course"} on LearnHub`,
                        });
                        toast({ title: "Shared", description: "Thanks for sharing!" });
                      } catch (err) {
                        if ((err as Error).name !== "AbortError") {
                          navigator.clipboard?.writeText(window.location.href);
                          toast({ title: "Link copied", description: "Course link copied to clipboard" });
                        }
                      }
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share...
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast({ title: "Link copied", description: "Course link copied to clipboard" });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const u = encodeURIComponent(window.location.href);
                    const t = encodeURIComponent(`${course?.title ?? "Course"} - LearnHub`);
                    window.open(`https://twitter.com/intent/tweet?url=${u}&text=${t}`, "_blank", "noopener,noreferrer,width=550,height=420");
                  }}
                >
                  <span className="mr-2 text-[0.9rem] font-bold">𝕏</span>
                  Share on X
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const u = encodeURIComponent(window.location.href);
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, "_blank", "noopener,noreferrer,width=550,height=420");
                  }}
                >
                  <span className="mr-2 text-sm font-semibold text-[#1877F2]">f</span>
                  Share on Facebook
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const u = encodeURIComponent(window.location.href);
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`, "_blank", "noopener,noreferrer,width=550,height=420");
                  }}
                >
                  <span className="mr-2 text-sm font-semibold text-[#0A66C2]">in</span>
                  Share on LinkedIn
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const subj = encodeURIComponent(`${course?.title ?? "Course"} - LearnHub`);
                    const body = encodeURIComponent(`Check out this course: ${window.location.href}`);
                    window.location.href = `mailto:?subject=${subj}&body=${body}`;
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Udemy-style: fixed right sidebar + scrollable left content */}
      <div className="flex min-h-[calc(100vh-44px)]">
        {/* Main content area */}
        <div className={`flex flex-col flex-1 min-w-0 overflow-y-auto transition-[margin] duration-300 ${sidebarCollapsed ? "" : "lg:mr-[350px]"}`}>
          {/* Video player — fixed dimensions, never resizes when tab content changes */}
          <div
            className="shrink-0 relative w-full bg-black transition-[height] duration-300"
            style={sidebarCollapsed
              ? { height: '82vh', minHeight: '450px', maxHeight: '800px' }
              : { height: '58vh', minHeight: '350px', maxHeight: '550px' }
            }
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {isEnrolled && selectedLesson ? (
                <div className="h-full w-full overflow-hidden bg-black">
                  {videoError ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <AlertCircle className="h-12 w-12 text-amber-500" />
                      <p className="font-medium text-white">Video could not be loaded</p>
                      <p className="text-sm text-gray-400">{videoError}</p>
                    </div>
                  ) : selectedLesson.videoUrl ? (
                    (() => {
                      const rawUrl = selectedLesson.videoUrl;
                      const isEmbed =
                        /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo/i.test(rawUrl) || rawUrl.includes("/embed/");
                      const isOurVideo = rawUrl?.startsWith("videos/") || rawUrl?.includes("/upload/video") || rawUrl?.includes("/upload/stream");
                      const videoUrl = isOurVideo
                        ? getSecureStreamUrl(course.id, selectedLesson._id!)
                        : (getSecureVideoSrc(rawUrl) || rawUrl);
                      let watermark: string | undefined;
                      try {
                        const u = window.localStorage.getItem("lms_user");
                        if (u) {
                          const parsed = JSON.parse(u);
                          const parts = [parsed.email, parsed.phone].filter(Boolean);
                          watermark = parts.length ? parts.join(" • ") : parsed.name;
                        }
                      } catch {
                        /* ignore */
                      }
                      return (
                        <SecureVideoPlayer
                          src={videoUrl}
                          poster={(course.image && getThumbnailSrc(course.image)) || undefined}
                          title={selectedLesson.title}
                          isEmbed={isEmbed}
                          watermarkText={isEmbed ? watermark : undefined}
                          onError={(msg) => setVideoError(msg)}
                          className="h-full w-full"
                          onPrev={prevLesson ? () => navigate(`/course/${course.id}/lesson/${prevLesson._id}`) : undefined}
                          prevTitle={prevLesson?.title}
                          onNext={nextLesson ? () => navigate(`/course/${course.id}/lesson/${nextLesson._id}`) : undefined}
                          nextTitle={nextLesson?.title}
                          autoplay={autoplay}
                          onAutoplayChange={setAutoplay}
                          isExpanded={sidebarCollapsed}
                          onExpandToggle={() => setSidebarCollapsed(prev => !prev)}
                          initialTime={selectedLesson._id ? watchTimestamps[selectedLesson._id] : undefined}
                          onTimeReport={handleTimeReport}
                          seekToRef={seekToRef}
                        />
                      );
                    })()
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-400">
                      <Play className="h-10 w-10" />
                      <p>No video for this lesson</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-gray-500">
                  {isEnrolled && lessons.length > 0 ? (
                    <>
                      <button
                        onClick={() => navigate(`/course/${course.id}/lesson/${lessons[0]._id}`)}
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white transition hover:bg-amber-600"
                      >
                        <Play className="h-8 w-8 fill-current" />
                      </button>
                      <p className="text-sm text-white">Select a lesson to start</p>
                    </>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-700">
                        <span className="text-2xl">▶</span>
                      </div>
                      <p className="text-sm">
                        {isEnrolled ? "Select a lesson from the list" : "Enroll to access course content"}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Below-video content — contain overflow so text wraps, player stays fixed */}
          <div className="min-w-0 overflow-x-hidden shrink-0 px-6 lg:px-16 py-4 space-y-4">
            {/* Tabs */}
            <div className="border-b border-gray-200 sticky top-0 z-10 bg-white">
              <nav className="flex gap-8 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap pb-3 pt-2 text-sm font-bold transition-colors relative ${
                      activeTab === tab
                        ? "text-gray-900"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === "Overview" && (
              <div className="space-y-8 py-4 min-w-0 break-words">
                {selectedLesson && (
                  <p className="text-lg font-semibold text-gray-900">{selectedLesson.title}</p>
                )}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-amber-600">{course.rating.toFixed(1)}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.floor(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                      <span className="text-gray-500 underline">({(course.ratingCount || 0).toLocaleString()} ratings)</span>
                    </div>
                    <div className="font-medium text-gray-900">
                      {totalHours} total
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Last updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>English, English [Auto]</span>
                    </div>
                  </div>
                </div>

                {/* Description - course description (not video titles) */}
                <section>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
                  <div className="text-gray-700 whitespace-pre-wrap leading-relaxed break-words">
                    {course.description || "No description available."}
                  </div>
                </section>

                {/* Instructor section - Udemy-style */}
                <section>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Instructor</h2>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <div className="absolute inset-0 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-200">
                        <span className="text-lg font-bold text-amber-600">
                          {(course.instructor || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {apiCourse?.instructorPhoto && (
                        <img
                          src={apiCourse.instructorPhoto}
                          alt={course.instructor || "Instructor"}
                          className="relative z-10 w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">{course.instructor || "Instructor"}</h3>
                      {apiCourse?.instructorTitle && (
                        <p className="text-sm text-amber-600 font-medium mt-0.5">{apiCourse.instructorTitle}</p>
                      )}
                      {apiCourse?.instructorBio && (
                        <p className="text-gray-600 text-sm mt-3 leading-relaxed whitespace-pre-wrap break-words">
                          {apiCourse.instructorBio}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "Notes" && (
              <div className="min-w-0 break-words">
                <h2 className="text-lg font-bold text-gray-900">Notes</h2>
                {activeNoteLessonId ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800 text-white text-xs font-medium">
                        {formatWatchTime(currentVideoTime)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {editingNote ? "Edit your note" : `Add a note at ${formatWatchTime(currentVideoTime)}`}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="relative max-w-full">
                        <textarea
                          className="w-full max-w-full p-3 border border-gray-300 rounded-md resize-none text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 break-words"
                          rows={4}
                          placeholder="Add a note for this lesson..."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={1000}
                        />
                        <span className="absolute top-2 right-2 text-xs text-gray-400">{note.length}/1000</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          onClick={handleSaveNote}
                          disabled={(saveNoteMutation.isPending || updateNoteMutation.isPending) || !note.trim()}
                          className="bg-amber-500 hover:bg-amber-600"
                        >
                          {(saveNoteMutation.isPending || updateNoteMutation.isPending) ? "Saving..." : editingNote ? "Save note" : "Save note"}
                        </Button>
                        {editingNote && (
                          <Button variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-gray-200">
                      <select
                        value={notesFilter}
                        onChange={(e) => setNotesFilter(e.target.value as "current" | "all")}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                      >
                        <option value="current">This lecture</option>
                        <option value="all">All lectures</option>
                      </select>
                      <select
                        value={notesSort}
                        onChange={(e) => setNotesSort(e.target.value as "recent" | "oldest")}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                      >
                        <option value="recent">Sort by most recent</option>
                        <option value="oldest">Sort by oldest</option>
                      </select>
                    </div>
                    {displayedNotes.length > 0 && (
                      <ul className="space-y-4 pt-2">
                        {displayedNotes.map((entry, idx) => (
                          <li key={`${entry.lessonId}-${entry.index}`} className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50/50 min-w-0 overflow-hidden">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <button
                                    type="button"
                                    onClick={() => seekToRef.current?.(entry.videoTimestamp ?? 0)}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-800 text-white text-xs font-medium hover:bg-gray-700"
                                  >
                                    {formatWatchTime(entry.videoTimestamp ?? 0)}
                                  </button>
                                  <span className="text-xs text-gray-500 truncate max-w-[200px]">{entry.lessonTitle}</span>
                                </div>
                                <p className="text-gray-800 whitespace-pre-wrap text-sm break-words">{entry.text}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNote({ lessonId: entry.lessonId, index: entry.index });
                                    setNote(entry.text);
                                  }}
                                  className="p-1.5 rounded text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (courseParam && window.confirm("Delete this note?")) {
                                      deleteNoteMutation.mutate({
                                        courseId: courseParam,
                                        lessonId: entry.lessonId,
                                        noteIndex: entry.index
                                      });
                                    }
                                  }}
                                  className="p-1.5 rounded text-gray-500 hover:bg-red-100 hover:text-red-600"
                                  title="Delete"
                                  disabled={deleteNoteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {displayedNotes.length === 0 && (
                      <p className="text-sm text-gray-500 py-4">
                        {notesFilter === "all" ? "No notes yet across all lectures." : "No notes yet for this lecture."}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-gray-500">Select a lesson from the sidebar to add notes.</p>
                )}
              </div>
            )}

            {activeTab === "Announcements" && (
              <div className="min-w-0 break-words">
                <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
                <div className="mt-4 space-y-4">
                  {apiCourse?.announcements && apiCourse.announcements.length > 0 ? (
                    apiCourse.announcements.map((ann, idx) => (
                      <div key={idx} className="p-4 border border-gray-200 rounded-md bg-white">
                        <p className="font-semibold">{ann.title}</p>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{ann.content}</p>
                        {ann.postedAt && (
                          <p className="text-xs text-gray-400 mt-2">
                            Posted on: {new Date(ann.postedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No announcements yet.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Reviews" && (
              <div className="min-w-0 break-words">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Student Feedback</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1">
                    <div className="bg-gray-100 rounded-lg p-6 text-center sticky top-20">
                      <p className="text-5xl font-bold text-amber-500">{course.rating.toFixed(1)}</p>
                      <div className="flex justify-center my-2">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={`h-5 w-5 ${i < Math.floor(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">Average Rating</p>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold">Reviews</h3>
                        <div className="w-full max-w-xs">
                          <input type="text" placeholder="Search reviews..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" />
                        </div>
                      </div>
                      <div className="border-b border-gray-200 pb-4">
                        {userReview ? (
                          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <h4 className="text-md font-semibold mb-2 text-amber-800">Your Review</h4>
                            <div className="flex items-center gap-1 mb-2">
                              {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                  key={i}
                                  className={`h-5 w-5 ${
                                    i < userReview.rating ? "text-amber-400 fill-amber-400" : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-gray-700 italic">"{userReview.comment || userReview.text}"</p>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-md font-semibold mb-2">Leave a Review</h4>
                            <div className="flex items-center gap-2 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-5 w-5 cursor-pointer ${
                                    (hoverRating || rating) >= star
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-gray-300"
                                  }`}
                                  onMouseEnter={() => setHoverRating(star)}
                                  onMouseLeave={() => setHoverRating(0)}
                                  onClick={() => setRating(star)}
                                />
                              ))}
                            </div>
                            <textarea
                              placeholder="Write your review..."
                              className="w-full p-2 border border-gray-300 rounded-md"
                              rows={3}
                              value={review}
                              onChange={(e) => setReview(e.target.value)}
                            ></textarea>
                            <Button className="mt-2" onClick={handleSubmitReview} disabled={reviewMutation.isPending}>
                              {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="space-y-6">
                        {apiCourse?.reviews?.map((r, idx) => (
                          <div key={r._id || r.id || idx} className="border-b border-gray-200 pb-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 font-bold">
                                {(r.user?.name || r.author || "U")[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{r.user?.name || r.author || "User"}</p>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: 5 }, (_, i) => (<Star key={i} className={`h-3 w-3 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />))}
                                  </div>
                                  <span>{r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "Just now")}</span>
                                </div>
                                <p className="text-sm text-gray-700">{r.comment || r.text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline">Load more reviews</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className={`hidden lg:flex fixed top-[44px] h-[calc(100vh-44px)] w-[350px] flex-col border-l border-gray-200 bg-white transition-[right] duration-300 ${sidebarCollapsed ? "-right-[350px]" : "right-0"}`}>
          <div className="flex items-center border-b border-gray-200 flex-shrink-0 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Course content</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {sections && sections.length > 0 ? (
              sections.map((section) => {
                  const isExpanded = expandedSections.has(section.title);
                  const sectionLessons = section.lessons || [];
                  const completedCount = sectionLessons.filter(isLessonComplete).length;

                  return (
                    <div key={section.title} className="border-b border-gray-200">
                      <button
                        onClick={() => {
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.title)) {
                              next.delete(section.title);
                            } else {
                              next.add(section.title);
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight
                            className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-[15px] truncate">{section.title}</p>
                            <p className="text-xs text-gray-500">{completedCount} / {sectionLessons.length} completed</p>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="py-1">
                          {sectionLessons.length > 0 ? (
                            sectionLessons.map((lesson, i) => {
                              const lid = lesson._id;
                              const completed = isLessonComplete(lesson);
                              const canOpen = isEnrolled && !!lid;
                              const isActive = selectedLesson?._id === lid;
                              const savedTs = lid ? watchTimestamps[lid] : undefined;
                              const savedDur = lid ? watchDurations[lid] : undefined;
                              const watchPct = savedTs != null && savedDur && savedDur > 0
                                ? Math.min(100, Math.round((savedTs / savedDur) * 100))
                                : 0;
                              return (
                                <div
                                  key={lesson._id || i}
                                  className={`flex items-start gap-3 text-sm transition-colors ${
                                    isActive
                                      ? "mx-2 my-1 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2.5"
                                      : `px-4 py-2.5 ${canOpen ? "cursor-pointer hover:bg-gray-50" : ""}`
                                  }`}
                                  onClick={() => {
                                    if (canOpen) navigate(`/course/${course.id}/lesson/${lid}`);
                                  }}
                                  role={canOpen ? "button" : undefined}
                                >
                                  {completed && !isActive ? (
                                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                                  ) : isActive ? (
                                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                                      <Pause className="h-2.5 w-2.5 fill-current" />
                                    </span>
                                  ) : (
                                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs">
                                      {canOpen ? (
                                        <Play className="h-2.5 w-2.5" />
                                      ) : (
                                        <span className="text-gray-400">○</span>
                                      )}
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 font-medium text-gray-900">{lesson.title}</p>
                                    <div className="mt-0.5 flex items-center gap-2">
                                      {isActive && (
                                        <span className="text-xs font-medium text-amber-600">Now playing</span>
                                      )}
                                      {!isActive && watchPct > 0 && watchPct < 90 && !completed && (
                                        <span className="text-xs font-medium text-amber-600">Resume at {formatWatchTime(savedTs!)}</span>
                                      )}
                                      {lesson.duration && (
                                        <span className="text-xs text-gray-500">{lesson.duration}</span>
                                      )}
                                      {lesson.resources && lesson.resources.length > 0 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 gap-1 px-2 text-xs text-purple-600"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <FileText className="h-3 w-3" />
                                          Resources
                                          <ChevronDown className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                    {watchPct > 0 && !completed && (
                                      <div className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-amber-500 transition-all"
                                          style={{ width: `${watchPct}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="py-3 text-center text-sm text-gray-500">No lessons in this section</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">No lessons added yet</p>
              )}
          </div>
        </aside>

        {/* Mobile: course content below main content */}
        <div className="lg:hidden px-4 pb-8">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="font-bold text-gray-900">Course content</h3>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {sections && sections.length > 0 ? (
                sections.map((section) => {
                  const isExpanded = expandedSections.has(section.title);
                  const sectionLessons = section.lessons || [];
                  const completedCount = sectionLessons.filter(isLessonComplete).length;

                  return (
                    <div key={section.title} className="border-b border-gray-200 last:border-b-0">
                      <button
                        onClick={() => {
                          setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(section.title)) {
                              next.delete(section.title);
                            } else {
                              next.add(section.title);
                            }
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-2 py-3 px-4 hover:bg-gray-50 transition"
                      >
                        <ChevronRight
                          className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900 text-sm">{section.title}</p>
                          <p className="text-xs text-gray-500">{completedCount} / {sectionLessons.length} completed</p>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-gray-100 pl-6">
                          {sectionLessons.map((lesson, i) => {
                            const lid = lesson._id;
                            const completed = isLessonComplete(lesson);
                            const canOpen = isEnrolled && !!lid;
                            return (
                              <div
                                key={lesson._id || i}
                                className={`flex items-start gap-2 px-3 py-2.5 text-sm ${
                                  canOpen ? "cursor-pointer hover:bg-gray-50" : ""
                                } ${selectedLesson?._id === lid ? "bg-amber-50" : ""}`}
                                onClick={() => {
                                  if (canOpen) navigate(`/course/${course.id}/lesson/${lid}`);
                                }}
                                role="button"
                              >
                                {completed ? (
                                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                                ) : (
                                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs">
                                    {canOpen ? <Play className="h-2.5 w-2.5" /> : <span className="text-gray-400">○</span>}
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-2 font-medium text-gray-900">{lesson.title}</p>
                                  {lesson.duration && (
                                    <span className="text-xs text-gray-500">{lesson.duration}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">No lessons added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
