import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Video, Clock, Upload, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiCourse } from "@/lib/api";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";

type LessonEdit = { title: string; videoUrl: string };
type Section = { _id?: string; title: string; lessons?: any[] };

const AdminCoursePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Section management state
  const [newSection, setNewSection] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  
  // Lesson management state
  const [newLesson, setNewLesson] = useState({ title: "", videoUrl: "", duration: "" });
  const [newLessonThumbnail, setNewLessonThumbnail] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonEdit>({ title: "", videoUrl: "" });
  const [editThumbnail, setEditThumbnail] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<{ lessonId: string; title: string } | null>(null);
  const [lessonThumbnails, setLessonThumbnails] = useState<Record<string, string | null>>({});

  const { data: course, isLoading } = useQuery<ApiCourse>({
    queryKey: ["admin-course", id],
    queryFn: () => api.getCourseAdmin(id || ""),
    enabled: !!id
  });

  // Initialize sections from course
  useEffect(() => {
    if (course) {
      if (course.sections && course.sections.length > 0) {
        // Use sections from API if available
        setSections(course.sections);
        if (!selectedSectionId) {
          setSelectedSectionId(course.sections[0]._id || "default");
        }
      } else if (course.lessons && course.lessons.length > 0) {
        // Fallback: group lessons into default section
        const defaultSection: Section = {
          title: "Course Content",
          lessons: course.lessons
        };
        setSections([defaultSection]);
        if (!selectedSectionId) {
          setSelectedSectionId("default");
        }
      } else {
        setSections([]);
      }
    }
  }, [course]);

  // Generate thumbnails for all lessons when course loads
  useEffect(() => {
    sections.forEach((section) => {
      section.lessons.forEach((lesson) => {
        if (lesson.videoUrl && lesson._id && !lessonThumbnails[lesson._id]) {
          generateThumbnail(lesson.videoUrl).then((thumb) => {
            if (thumb) {
              setLessonThumbnails((prev) => ({ ...prev, [lesson._id!]: thumb }));
            }
          });
        }
      });
    });
  }, [sections]);

  const addSectionMutation = useMutation({
    mutationFn: async () => {
      if (!newSection.trim()) {
        throw new Error("Section title is required");
      }
      return api.addSection(id!, { title: newSection.trim() });
    },
    onSuccess: () => {
      toast({ title: "Section created", description: "New section added to course" });
      setNewSection("");
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
    },
    onError: (err) => {
      toast({
        title: "Failed to create section",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const addLessonMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSectionId) {
        throw new Error("Please select a section first");
      }
      // Add to section if it has an ID, otherwise add to course lessons
      if (selectedSectionId === "default") {
        return api.addLesson(id!, {
          title: newLesson.title.trim(),
          duration: newLesson.duration.trim() || undefined,
          videoUrl: newLesson.videoUrl.trim() || undefined
        });
      } else {
        return api.addLessonToSection(id!, selectedSectionId, {
          title: newLesson.title.trim(),
          duration: newLesson.duration.trim() || undefined,
          videoUrl: newLesson.videoUrl.trim() || undefined
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Lesson added", description: "The lesson has been saved" });
      setNewLesson({ title: "", videoUrl: "", duration: "" });
      setNewLessonThumbnail(null);
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (err) => {
      toast({
        title: "Failed to add lesson",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const updateLessonMutation = useMutation({
    mutationFn: async ({ lessonId, data }: { lessonId: string; data: LessonEdit }) => {
      return api.updateLesson(id!, lessonId, {
        title: data.title.trim(),
        duration: editDuration.trim() || undefined,
        videoUrl: data.videoUrl.trim() || undefined
      });
    },
    onSuccess: () => {
      toast({ title: "Lesson updated", description: "Changes have been saved" });
      setEditingLessonId(null);
      setEditThumbnail(null);
      setEditDuration("");
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", id] });
    },
    onError: (err) => {
      toast({
        title: "Failed to update lesson",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => api.deleteLesson(id!, lessonId),
    onSuccess: () => {
      toast({ title: "Lesson deleted", description: "The lesson has been removed" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", id] });
    },
    onError: (err) => {
      toast({
        title: "Failed to delete lesson",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const startEdit = (lesson: { _id?: string; title: string; videoUrl?: string; duration?: string }) => {
    if (lesson._id) {
      setEditingLessonId(lesson._id);
      setEditForm({
        title: lesson.title,
        videoUrl: lesson.videoUrl || ""
      });
      setEditDuration(lesson.duration || "");
      if (lesson.videoUrl) {
        generateThumbnail(lesson.videoUrl).then(setEditThumbnail);
      }
    }
  };

  const cancelEdit = () => {
    setEditingLessonId(null);
    setEditThumbnail(null);
    setEditDuration("");
  };

  const extractDurationFromFile = async (file: File): Promise<string | undefined> => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      
      const duration = await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(NaN);
        }, 5000);
        const handleMetadata = () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve(video.duration);
        };
        video.addEventListener("loadedmetadata", handleMetadata, { once: true });
      });
      
      if (isNaN(duration) || duration === 0 || duration === Infinity) return undefined;
      
      const totalSeconds = Math.round(duration);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    } catch (e) {
      console.error("Duration extraction failed:", e);
      return undefined;
    }
  };

  const extractThumbnailFromFile = async (file: File): Promise<string | null> => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.src = url;
      video.currentTime = 1;

      const thumbnail = await new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(null);
        }, 5000);
        const handleSeeked = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d")?.drawImage(video, 0, 0);
            const thumb = canvas.toDataURL("image/jpeg", 0.7);
            URL.revokeObjectURL(url);
            resolve(thumb);
          } catch (e) {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };
        video.addEventListener("seeked", handleSeeked, { once: true });
      });

      return thumbnail;
    } catch (e) {
      console.error("Thumbnail extraction failed:", e);
      return null;
    }
  };

  const extractDuration = async (videoUrl: string): Promise<string | undefined> => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      
      const duration = await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(NaN), 8000);
        const handleMetadata = () => {
          clearTimeout(timeout);
          resolve(video.duration);
        };
        video.addEventListener("loadedmetadata", handleMetadata, { once: true });
      });
      
      if (isNaN(duration) || duration === 0) return undefined;
      
      const totalSeconds = Math.round(duration);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    } catch (e) {
      console.error("Duration extraction failed:", e);
      return undefined;
    }
  };

  const generateThumbnail = async (videoUrl: string): Promise<string | null> => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = videoUrl;
      video.currentTime = 1;
      await new Promise((resolve) => {
        video.addEventListener("seeked", resolve, { once: true });
        setTimeout(resolve, 3000);
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch (e) {
      return null;
    }
  };

  if (isLoading || !course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const lessons = course.lessons ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Manage Course – LearnHub Admin</title>
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
        <p className="mt-1 text-gray-600">Manage course content and lessons</p>

        {/* Sections Management */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Course Sections</h2>
          <p className="mt-1 text-sm text-gray-600">Organize lessons into sections (like Udemy)</p>
          
          <div className="mt-4 space-y-3">
            {sections.map((section) => (
              <div
                key={section._id || "default"}
                className={`p-3 border rounded cursor-pointer transition ${
                  selectedSectionId === (section._id || "default")
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 bg-gray-50 hover:border-amber-300"
                }`}
                onClick={() => setSelectedSectionId(section._id || "default")}
              >
                <p className="font-medium text-gray-900">{section.title}</p>
                <p className="text-xs text-gray-500">{section.lessons.length} lessons</p>
              </div>
            ))}
          </div>

          {/* Add new section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Input
                placeholder="New section title"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addSectionMutation.mutate();
                  }
                }}
              />
              <Button
                onClick={() => addSectionMutation.mutate()}
                disabled={!newSection.trim() || addSectionMutation.isPending}
                size="sm"
              >
                {addSectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Add Lesson */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Add Lesson</h2>
          <p className="mt-1 text-sm text-gray-600">
            Add lessons to <strong>{selectedSectionId && sections.find(s => s._id === selectedSectionId || s._id === null)?.title || "Course Content"}</strong>
          </p>
          {newLessonThumbnail && (
            <div className="mt-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Video Thumbnail Preview</p>
              <img src={newLessonThumbnail} alt="thumbnail" className="w-32 h-24 object-cover rounded border border-gray-200" />
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Lesson title"
              value={newLesson.title}
              onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Video URL or paste link"
                value={newLesson.videoUrl}
                onChange={(e) => setNewLesson((p) => ({ ...p, videoUrl: e.target.value }))}
              />
              <input
                type="file"
                id="video-upload"
                accept="video/mp4,video/webm,video/ogg"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingVideo(true);
                  e.target.value = "";
                  try {
                    // Extract duration and thumbnail before upload
                    const duration = await extractDurationFromFile(file);
                    const thumbnail = await extractThumbnailFromFile(file);
                    const { url } = await api.uploadVideo(file);
                    setNewLesson((p) => ({ ...p, videoUrl: url, duration: duration || "" }));
                    if (thumbnail) setNewLessonThumbnail(thumbnail);
                    toast({ title: "Video uploaded", description: "Duration and thumbnail auto-detected" });
                  } catch (err) {
                    toast({
                      title: "Upload failed",
                      description: err instanceof Error ? err.message : "Please try again",
                      variant: "destructive"
                    });
                  } finally {
                    setUploadingVideo(false);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Upload video file (MP4, WebM)"
                onClick={() => document.getElementById("video-upload")?.click()}
                disabled={uploadingVideo}
              >
                {uploadingVideo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <Button
            className="mt-4 gap-2"
            onClick={() => {
              if (!newLesson.title.trim()) {
                toast({ title: "Title required", variant: "destructive" });
                return;
              }
              addLessonMutation.mutate();
            }}
            disabled={addLessonMutation.isPending || !newLesson.title.trim()}
          >
            <Plus className="h-4 w-4" /> Add Lesson
          </Button>
        </div>

        {/* Lessons List by Section */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Course Content</h2>
          <p className="mt-1 text-sm text-gray-600">Lessons organized by sections</p>
          
          {sections.length > 0 ? (
            <div className="mt-4 space-y-6">
              {sections.map((section) => (
                <div key={section._id || "default"} className="border-t pt-6 first:border-t-0 first:pt-0">
                  <h3 className="text-md font-bold text-gray-900 mb-4">{section.title}</h3>
                  {section.lessons && section.lessons.length > 0 ? (
                    <ul className="space-y-2">
                      {section.lessons.map((lesson, i) => (
                        <li
                          key={lesson._id || i}
                  className="rounded border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  {editingLessonId === lesson._id ? (
                    <div className="space-y-3">
                      {editThumbnail && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Video Thumbnail</p>
                          <img src={editThumbnail} alt="thumbnail" className="w-32 h-24 object-cover rounded border border-gray-200" />
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Lesson title"
                          value={editForm.title}
                          onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Video URL"
                            value={editForm.videoUrl}
                            onChange={(e) => setEditForm((p) => ({ ...p, videoUrl: e.target.value }))}
                          />
                          <input
                            type="file"
                            id={`video-upload-edit-${lesson._id}`}
                            accept="video/mp4,video/webm,video/ogg"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingVideo(true);
                              e.target.value = "";
                              try {
                                // Extract duration and thumbnail before upload
                                const duration = await extractDurationFromFile(file);
                                const thumbnail = await extractThumbnailFromFile(file);
                                const { url } = await api.uploadVideo(file);
                                setEditForm((p) => ({ ...p, videoUrl: url }));
                                setEditDuration(duration || "");
                                if (thumbnail) setEditThumbnail(thumbnail);
                                toast({ title: "Video uploaded", description: "Duration and thumbnail auto-detected" });
                              } catch (err) {
                                toast({
                                  title: "Upload failed",
                                  description: err instanceof Error ? err.message : "Please try again",
                                  variant: "destructive"
                                });
                              } finally {
                                setUploadingVideo(false);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Upload video"
                            onClick={() => document.getElementById(`video-upload-edit-${lesson._id}`)?.click()}
                            disabled={uploadingVideo}
                          >
                            {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateLessonMutation.mutate({ lessonId: lesson._id!, data: editForm })}
                          disabled={updateLessonMutation.isPending || !editForm.title.trim()}
                        >
                          {updateLessonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 w-6 text-right">{i + 1}.</span>
                        {lesson._id && lessonThumbnails[lesson._id] && (
                          <img
                            src={lessonThumbnails[lesson._id]}
                            alt="thumbnail"
                            className="w-14 h-10 object-cover rounded border border-gray-200 flex-shrink-0"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{lesson.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                          {lesson.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {lesson.duration}
                            </span>
                          )}
                          {lesson.videoUrl && (
                            <span className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              Video
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit lesson"
                          onClick={() => startEdit(lesson)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete lesson"
                          onClick={() => setDeleteTarget({ lessonId: lesson._id!, title: lesson.title })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No lessons in this section yet.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 py-8 text-center text-gray-500">No sections or lessons yet. Add lessons above.</p>
          )}
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete lesson</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteTarget && deleteLessonMutation.mutate(deleteTarget.lessonId)}
              >
                {deleteLessonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="outline" className="mt-6" onClick={() => navigate(`/course/${id}`)}>
          View Course Page
        </Button>
      </div>
    </div>
  );
};

export default AdminCoursePage;
