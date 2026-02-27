import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Clock, BookOpen, Users, CheckCircle, ArrowLeft, ChevronDown, FileText, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiCourse, ApiEnrollment, ApiProgress, getThumbnailSrc, getVideoSrc, mapApiCourseToCourse } from "@/lib/api";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";

const tabs = ["Overview", "Q&A", "Notes", "Announcements", "Reviews", "Learning tools"];

const CourseDetail = () => {
  const { id, courseId, lessonId } = useParams<{ id?: string; courseId?: string; lessonId?: string }>();
  const courseParam = id ?? courseId ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    setVideoError(null);
  }, [lessonId]);
  const [activeTab, setActiveTab] = useState("Overview");

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
  const nextLesson = selectedIndex >= 0 && selectedIndex + 1 < lessons.length ? lessons[selectedIndex + 1] : null;

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

      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4">
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
      </div>

      <div className="container mx-auto px-4 py-8">
        <Link
          to="/courses"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Courses
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Video player - plays in container when lesson selected */}
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-900">
              {isEnrolled && selectedLesson ? (
                <>
                  <div className="flex h-full w-full items-center justify-center overflow-hidden bg-muted">
                    {videoError ? (
                      <div className="flex flex-col items-center gap-3 p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-amber-500" />
                        <p className="font-medium text-white">Video could not be loaded</p>
                        <p className="text-sm text-gray-400">{videoError}</p>
                      </div>
                    ) : selectedLesson.videoUrl ? (
                      (() => {
                        const rawUrl = selectedLesson.videoUrl;
                        const videoUrl = getVideoSrc(rawUrl) || rawUrl;
                        const isEmbed =
                          /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo/i.test(rawUrl) || rawUrl.includes("/embed/");
                        return isEmbed ? (
                          <iframe
                            src={videoUrl}
                            title={selectedLesson.title}
                            className="h-full w-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={videoUrl}
                            controls
                            className="h-full w-full object-contain"
                            playsInline
                            preload="metadata"
                            onError={() =>
                              setVideoError(
                                "The URL may be invalid or in an unsupported format."
                              )
                            }
                          >
                            <track kind="captions" />
                          </video>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Play className="h-10 w-10" />
                        <p>No video for this lesson</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-700 bg-gray-800/50 px-4 py-3">
                    <Link
                      to={`/course/${course.id}`}
                      className="mb-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Course overview
                    </Link>
                    <h3 className="font-semibold text-white">{selectedLesson.title}</h3>
                    {selectedLesson.content && (
                      <p className="mt-1 text-sm text-gray-400 line-clamp-2">{selectedLesson.content}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
                        onClick={() => completeMutation.mutate()}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark complete
                      </Button>
                      {nextLesson && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                          onClick={() => navigate(`/course/${course.id}/lesson/${nextLesson._id}`)}
                        >
                          Next lesson
                        </Button>
                      )}
                    </div>
                  </div>
                </>
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

            {/* Course title */}
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{course.title}</h1>

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

            {course.updatedAt && (
              <p className="text-sm text-gray-600">
                Last updated {new Date(course.updatedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            )}

            <p className="text-sm text-gray-600">Language: English</p>

            {/* Description */}
            <div>
              <h2 className="text-lg font-bold text-gray-900">About this course</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {course.description}
              </p>
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

          {/* Right sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {!isEnrolled && (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <img
                    src={getThumbnailSrc(course.image) || course.image}
                    alt={course.title}
                    className="aspect-video w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="p-4">
                    <div className="mb-4 text-2xl font-bold text-gray-900">${course.price}</div>
                    <Button
                      size="lg"
                      className="w-full bg-amber-500 font-semibold text-white hover:bg-amber-600"
                      onClick={() => navigate(`/course/${course.id}/payment`)}
                    >
                      Enroll now
                    </Button>
                    <p className="mt-4 text-center text-xs text-gray-500">30-day money-back guarantee</p>
                  </div>
                </div>
              )}

              {/* Course content */}
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Course content</h3>
                </div>
                <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                  {course.lessonItems && course.lessonItems.length > 0 ? (
                    course.lessonItems.map((lesson, i) => {
                      const lid = lesson._id;
                      const completed = lid ? completedLessonIds.has(lid) : false;
                      const canOpen = isEnrolled && !!lid;
                      return (
                        <div
                          key={lesson._id || i}
                          className={`flex items-start gap-2 rounded border px-3 py-2 text-sm ${
                            canOpen
                              ? "cursor-pointer border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/50"
                              : "border-gray-100 bg-gray-50/50"
                          } ${selectedLesson?._id === lid ? "border-amber-400 bg-amber-50/50" : ""}`}
                          onClick={() => {
                            if (canOpen) navigate(`/course/${course.id}/lesson/${lid}`);
                          }}
                          role={canOpen ? "button" : undefined}
                        >
                          {completed ? (
                            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                          ) : (
                            <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs">
                              {canOpen ? (
                                <Play className="h-2.5 w-2.5" />
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 font-medium text-gray-900">{lesson.title}</p>
                            <div className="mt-1 flex items-center gap-2">
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
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-4 text-center text-sm text-gray-500">No lessons added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
