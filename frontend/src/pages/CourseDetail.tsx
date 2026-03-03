import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Clock, BookOpen, Users, CheckCircle, ArrowLeft, ChevronDown, FileText, Play, Pause, CheckCircle2, AlertCircle, ChevronRight, Edit, Trophy, Share2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiCourse, ApiEnrollment, ApiProgress, ApiWatchTimestamps, getThumbnailSrc, getSecureVideoSrc, mapApiCourseToCourse, getUserRoleFromToken } from "@/lib/api";
import { SecureVideoPlayer } from "@/components/SecureVideoPlayer";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";

const tabs = ["Overview", "Q&A", "Notes", "Announcements", "Reviews", "Learning tools"];

function formatWatchTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  const hasToken = typeof window !== "undefined" && !!window.localStorage.getItem("lms_token");

  const { data: apiCourse, isLoading, error } = useQuery<ApiCourse>({
    queryKey: ["course", courseParam],
    queryFn: () => api.getCourse(courseParam),
    enabled: !!courseParam
  });

  const { data: enrollments } = useQuery<ApiEnrollment[]>({
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

  const { data: watchData } = useQuery<ApiWatchTimestamps>({
    queryKey: ["watchTimestamps", courseParam],
    queryFn: () => api.getWatchTimestamps(courseParam),
    enabled: hasToken && !!courseParam && (enrollments?.some((e) => (e.course?._id || e.course?.id) === courseParam) ?? false),
    retry: false
  });

  const watchTimestamps = watchData?.timestamps ?? {};
  const watchDurations = watchData?.durations ?? {};

  const saveTimestampRef = useRef<ReturnType<typeof setTimeout>>();
  const handleTimeReport = useCallback((currentTime: number, videoDuration: number) => {
    if (!courseParam || !lessonId) return;
    queryClient.setQueryData<ApiWatchTimestamps>(["watchTimestamps", courseParam], (old) => ({
      timestamps: { ...(old?.timestamps ?? {}), [lessonId]: currentTime },
      durations: { ...(old?.durations ?? {}), [lessonId]: videoDuration }
    }));
    if (saveTimestampRef.current) clearTimeout(saveTimestampRef.current);
    saveTimestampRef.current = setTimeout(() => {
      api.saveWatchTimestamp(courseParam, lessonId, currentTime, videoDuration).catch(() => {});
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

  const course = apiCourse ? mapApiCourseToCourse(apiCourse) : null;
  const lessons = course?.lessonItems ?? [];
  const selectedLesson = lessonId ? lessons.find((l) => l._id === lessonId) ?? lessons[0] : null;
  const selectedIndex = selectedLesson ? lessons.findIndex((l) => l._id === selectedLesson._id) : -1;
  const prevLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 && selectedIndex + 1 < lessons.length ? lessons[selectedIndex + 1] : null;
  const [autoplay, setAutoplay] = useState(false);

  // Get sections if available, otherwise create default section from lessons
  const sections = apiCourse?.sections && apiCourse.sections.length > 0
    ? apiCourse.sections
    : lessons.length > 0
    ? [{ title: "Course Content", lessons }]
    : [];

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
  }, [sections, selectedLesson?._id]);

  const totalDuration = course?.lessonItems?.reduce((acc, l) => {
    const d = l.duration?.match(/(\d+)/);
    return acc + (d ? parseInt(d[1], 10) : 0);
  }, 0) ?? 0;
  const totalHours = totalDuration ? `${Math.round(totalDuration / 60)} hours` : course?.duration || "—";

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
                    <strong>Price:</strong> ${course.price}
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
                      <p className="text-xs text-gray-500">{section.lessons?.length || 0} lessons</p>
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

  // Non-enrolled: show course detail landing page
  if (!isEnrolled && !lessonId) {
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

        {/* Hero section */}
        <div className="bg-gray-900 text-white">
          <div className="container mx-auto px-4 py-10 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Courses
                </Link>
                <h1 className="text-3xl font-bold sm:text-4xl">{course.title}</h1>
                <p className="text-lg text-gray-300 leading-relaxed">{course.description}</p>
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
                    <span className="text-gray-400">({course.students.toLocaleString()} ratings)</span>
                  </span>
                  <span className="text-gray-400">{course.students.toLocaleString()} students</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  {course.instructor && <span>Created by <span className="text-amber-400 underline">{course.instructor}</span></span>}
                  {course.category && <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" /> {course.category}</span>}
                  {course.level && <span className="capitalize">{course.level}</span>}
                  <span>Language: English</span>
                </div>
              </div>

              {/* Enroll card */}
              <div className="lg:col-span-1">
                <div className="overflow-hidden rounded-lg bg-white shadow-lg">
                  {course.image && (
                    <img
                      src={getThumbnailSrc(course.image) || course.image}
                      alt={course.title}
                      className="aspect-video w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="p-6 space-y-4">
                    <div className="text-3xl font-bold text-gray-900">${course.price}</div>
                    <Button
                      size="lg"
                      className="w-full bg-amber-500 font-semibold text-white hover:bg-amber-600 text-lg py-6"
                      onClick={() => navigate(`/course/${course.id}/payment`)}
                    >
                      Enroll now
                    </Button>
                    <p className="text-center text-xs text-gray-500">30-day money-back guarantee</p>
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
          </div>
        </div>

        {/* Course content */}
        <div className="container mx-auto px-4 py-10">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              {/* What you'll learn */}
              {lessons.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">What you'll learn</h2>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {lessons.slice(0, 8).map((l, i) => (
                      <li key={l._id || i} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                        {l.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                            <span className="text-xs text-gray-500">{sectionLessons.length} lessons</span>
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
              <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-10 rounded-lg border border-border bg-card p-3 shadow-lg min-w-[180px]">
                <p className="text-sm font-medium text-foreground">Progress</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {completedLessonIds.size} of {lessons.length} lessons completed
                </p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${lessons.length ? (completedLessonIds.size / lessons.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast({ title: "Link copied", description: "Course link copied to clipboard" });
              }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="More options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Udemy-style: fixed right sidebar + scrollable left content */}
      <div className="flex min-h-[calc(100vh-44px)]">
        {/* Main content area */}
        <div className={`flex-1 min-w-0 overflow-y-auto transition-[margin] duration-300 ${sidebarCollapsed ? "" : "lg:mr-[350px]"}`}>
          {/* Video player — Udemy style: grows taller in expanded view */}
          <div
            className="relative w-full bg-black transition-[height] duration-300"
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
                      const videoUrl = getSecureVideoSrc(rawUrl) || rawUrl;
                      const isEmbed =
                        /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo/i.test(rawUrl) || rawUrl.includes("/embed/");
                      let watermark: string | undefined;
                      try {
                        const u = window.localStorage.getItem("lms_user");
                        if (u) {
                          const parsed = JSON.parse(u);
                          watermark = parsed.email || parsed.name;
                        }
                      } catch {
                        /* ignore */
                      }
                      return (
                        <SecureVideoPlayer
                          src={videoUrl}
                          title={selectedLesson.title}
                          isEmbed={isEmbed}
                          watermarkText={watermark}
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

          {/* Below-video content */}
          <div className="px-6 lg:px-16 py-6 space-y-6">
            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="font-semibold text-amber-600">{course.rating.toFixed(1)}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.floor(course.rating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
                    />
                  ))}
                </div>
                <span className="text-gray-600">({course.students.toLocaleString()} ratings)</span>
              </span>
              <span className="text-gray-600">{course.students.toLocaleString()} Students</span>
              <span className="text-gray-600">{totalHours} Total</span>
            </div>

            <p className="text-sm text-gray-600">Language: English</p>

            {!isEnrolled && (
              <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-2xl font-bold text-gray-900">${course.price}</div>
                <Button
                  size="lg"
                  className="bg-amber-500 font-semibold text-white hover:bg-amber-600"
                  onClick={() => navigate(`/course/${course.id}/payment`)}
                >
                  Enroll now
                </Button>
                <p className="text-xs text-gray-500">30-day money-back guarantee</p>
              </div>
            )}

            {/* Description */}
            <div>
              <h2 className="text-lg font-bold text-gray-900">About this course</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {course.description}
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
              <nav className="flex gap-6 overflow-x-auto py-3">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "border-gray-900 text-gray-900"
                        : "border-transparent text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === "Overview" && course.lessonItems && course.lessonItems.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900">What you'll learn</h2>
                <ul className="mt-3 space-y-2">
                  {course.lessonItems.slice(0, 6).map((l, i) => (
                    <li key={l._id || i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      {l.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Fixed right sidebar - Course content (Udemy style) */}
        <aside className={`hidden lg:flex fixed top-[44px] h-[calc(100vh-44px)] w-[350px] flex-col border-l border-gray-200 bg-white transition-[right] duration-300 ${sidebarCollapsed ? "-right-[350px]" : "right-0"}`}>
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <h3 className="font-bold text-gray-900">Course content</h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {sections && sections.length > 0 ? (
              sections.map((section) => {
                const isExpanded = expandedSections.has(section.title);
                const sectionLessons = section.lessons || [];
                const completedCount = sectionLessons.filter(l => l._id && completedLessonIds.has(l._id)).length;

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
                            const completed = lid ? completedLessonIds.has(lid) : false;
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
                                    {!isActive && watchPct > 0 && watchPct < 95 && !completed && (
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
                  const completedCount = sectionLessons.filter(l => l._id && completedLessonIds.has(l._id)).length;

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
                            const completed = lid ? completedLessonIds.has(lid) : false;
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
                                role={canOpen ? "button" : undefined}
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
