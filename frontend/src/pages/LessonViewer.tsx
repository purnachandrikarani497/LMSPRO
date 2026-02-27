import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Play, CheckCircle2, ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiCourse, getVideoSrc } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

const LessonViewer = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    setVideoError(null);
  }, [lessonId]);

  const { data: course, isLoading } = useQuery<ApiCourse>({
    queryKey: ["course", courseId],
    queryFn: () => api.getCourse(courseId || ""),
    enabled: !!courseId
  });

  const completeMutation = useMutation({
    mutationFn: () => api.completeLesson(courseId || "", lessonId || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", courseId] });
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

  if (isLoading || !course) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Loading lesson...</p>
        </div>
      </div>
    );
  }

  const lessons = course.lessons || [];
  const currentLesson =
    lessons.find((lesson) => lesson._id === lessonId) || lessons[0] || null;

  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">No lessons available for this course.</p>
        </div>
      </div>
    );
  }

  const currentIndex = lessons.findIndex((lesson) => lesson._id === currentLesson._id);
  const nextLesson = currentIndex >= 0 && currentIndex + 1 < lessons.length ? lessons[currentIndex + 1] : null;

  const rawVideoUrl = currentLesson.videoUrl || "";
  const videoUrl = getVideoSrc(rawVideoUrl) || rawVideoUrl;
  const isEmbedUrl =
    /youtube\.com|youtu\.be|vimeo\.com|player\.vimeo/i.test(rawVideoUrl) ||
    rawVideoUrl.includes("/embed/");

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{currentLesson.title} – {course.title}</title>
        <meta name="description" content={currentLesson.content || course.description} />
      </Helmet>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <Link
            to={`/course/${courseId}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <BookOpen className="h-4 w-4" />
            Course overview
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="aspect-video flex items-center justify-center overflow-hidden bg-muted">
                {videoError ? (
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <AlertCircle className="h-12 w-12 text-amber-500" />
                    <p className="font-medium">Video could not be loaded</p>
                    <p className="text-sm text-muted-foreground">{videoError}</p>
                    <p className="text-xs text-muted-foreground">
                      Use a direct link to .mp4 or .webm. Test with: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
                    </p>
                  </div>
                ) : currentLesson.videoUrl ? (
                  isEmbedUrl ? (
                    <iframe
                      src={videoUrl}
                      title={currentLesson.title}
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
                          "The URL may be invalid, blocked by CORS, or in an unsupported format. Try an MP4 from a public CDN."
                        )
                      }
                    >
                      <track kind="captions" />
                      Your browser does not support the video tag.
                    </video>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Play className="h-10 w-10" />
                    <p>No video for this lesson</p>
                    <p className="text-xs">
                      Add a direct .mp4 or .webm URL, or a YouTube/Vimeo embed link
                    </p>
                    <p className="text-xs">
                      Test URL: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
                    </p>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h1 className="font-heading text-2xl font-bold text-card-foreground">
                  {currentLesson.title}
                </h1>
                {currentLesson.content && (
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {currentLesson.content}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="gap-2 bg-gradient-gold text-primary shadow-gold hover:opacity-90"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark lesson complete
                  </Button>
                  {nextLesson && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/course/${courseId}/lesson/${nextLesson._id}`)
                      }
                    >
                      Next lesson
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Lessons
            </h2>
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              {lessons.map((lesson) => {
                const active = lesson._id === currentLesson._id;
                return (
                  <button
                    key={lesson._id}
                    type="button"
                    onClick={() =>
                      navigate(`/course/${courseId}/lesson/${lesson._id}`)
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-secondary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="line-clamp-1">{lesson.title}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </button>
                );
              })}
              {lessons.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Lessons will appear here once added.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default LessonViewer;

