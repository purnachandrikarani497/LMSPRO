import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Video, Clock, Upload, Loader2, Pencil, X, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

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
import { api, ApiCourse, getSecureVideoSrc } from "@/lib/api";
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing">("uploading");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonEdit>({ title: "", videoUrl: "" });
  const [editThumbnail, setEditThumbnail] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<{ lessonId: string; title: string } | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ sectionId: string; title: string } | null>(null);
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
        if (!selectedSectionId) setSelectedSectionId("default");
      }
    }
  }, [course]);


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

  const updateSectionMutation = useMutation({
    mutationFn: async ({ sectionId, title }: { sectionId: string; title: string }) => {
      return api.updateSection(id!, sectionId, { title: title.trim() });
    },
    onSuccess: () => {
      toast({ title: "Section updated", description: "Changes have been saved" });
      setEditingSectionId(null);
      setEditingSectionTitle("");
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
    },
    onError: (err) => {
      toast({
        title: "Failed to update section",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => api.deleteSection(id!, sectionId),
    onSuccess: (_data, sectionId) => {
      toast({ title: "Section deleted", description: "The section has been removed" });
      setDeleteSectionTarget(null);
      if (selectedSectionId === sectionId) {
        setSelectedSectionId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
    },
    onError: (err) => {
      toast({
        title: "Failed to delete section",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const addLessonMutation = useMutation({
    mutationFn: async () => {
      const targetSection = selectedSectionId || (sections.length === 0 ? "default" : null);
      if (!targetSection) {
        throw new Error("Please select a section first");
      }
      // Add to section if it has an ID, otherwise add to course lessons (default)
      if (targetSection === "default") {
        return api.addLesson(id!, {
          title: newLesson.title.trim(),
          duration: newLesson.duration.trim() || undefined,
          videoUrl: newLesson.videoUrl.trim() || undefined
        });
      } else {
        return api.addLessonToSection(id!, targetSection, {
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
      video.src = getSecureVideoSrc(videoUrl) || videoUrl;
      
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
            {sections.map((section) => {
              const sid = section._id || "default";
              const isEditing = editingSectionId === sid;
              const canEdit = !!section._id;
              return (
                <div
                  key={sid}
                  className={`p-3 border rounded transition ${
                    selectedSectionId === sid
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 bg-gray-50 hover:border-amber-300"
                  } ${!isEditing ? "cursor-pointer" : ""}`}
                  onClick={() => !isEditing && setSelectedSectionId(sid)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editingSectionTitle}
                            onChange={(e) => setEditingSectionTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateSectionMutation.mutate({ sectionId: sid, title: editingSectionTitle });
                              if (e.key === "Escape") {
                                setEditingSectionId(null);
                                setEditingSectionTitle("");
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateSectionMutation.mutate({ sectionId: sid, title: editingSectionTitle })}
                            disabled={!editingSectionTitle.trim() || updateSectionMutation.isPending}
                          >
                            {updateSectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSectionId(null);
                              setEditingSectionTitle("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">{section.title}</p>
                          <p className="text-xs text-gray-500">{section.lessons?.length ?? 0} lessons</p>
                        </>
                      )}
                    </div>
                    {canEdit && !isEditing && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-amber-600"
                          onClick={() => {
                            setEditingSectionId(sid);
                            setEditingSectionTitle(section.title);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteSectionTarget({ sectionId: sid, title: section.title })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLesson.title.trim()) {
                toast({ title: "Title required", variant: "destructive" });
                return;
              }
              if (!newLesson.videoUrl.trim()) {
                toast({ title: "Video required", description: "Please upload or paste a video URL before adding a lesson", variant: "destructive" });
                return;
              }
              addLessonMutation.mutate();
            }}
          >
          <div className="grid gap-4 sm:grid-cols-2">
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
                  setUploadProgress(0);
                  setUploadPhase("uploading");
                  setUploadFileName(file.name);
                  e.target.value = "";
                  try {
                    const duration = await extractDurationFromFile(file);
                    const thumbnail = await extractThumbnailFromFile(file);
                    const { url } = await api.uploadVideo(file, (pct) => {
                      setUploadProgress(pct);
                      if (pct >= 100) setUploadPhase("processing");
                    });
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
                    setUploadProgress(0);
                    setUploadPhase("uploading");
                    setUploadFileName("");
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
          {uploadingVideo && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3 mb-2">
                {uploadPhase === "processing" ? (
                  <Loader2 className="h-5 w-5 text-amber-600 shrink-0 animate-spin" />
                ) : (
                  <FileVideo className="h-5 w-5 text-amber-600 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{uploadFileName || "Uploading video..."}</p>
                  <p className="text-xs text-gray-500">
                    {uploadPhase === "processing"
                      ? "Saving to server, please wait..."
                      : `Uploading... ${uploadProgress}%`}
                  </p>
                </div>
                {uploadPhase === "uploading" && (
                  <span className="text-sm font-semibold text-amber-700">{uploadProgress}%</span>
                )}
              </div>
              {uploadPhase === "processing" ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100">
                  <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-amber-500" />
                </div>
              ) : (
                <Progress value={uploadProgress} className="h-2 bg-amber-100 [&>div]:bg-amber-500" />
              )}
            </div>
          )}
          <Button
            type="submit"
            className="mt-4 gap-2"
            disabled={addLessonMutation.isPending || !newLesson.title.trim() || !newLesson.videoUrl.trim() || uploadingVideo}
          >
            <Plus className="h-4 w-4" /> Add Lesson
          </Button>
          </form>
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
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateLessonMutation.mutate({ lessonId: lesson._id!, data: editForm });
                      }}
                    >
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
                              setUploadProgress(0);
                              setUploadPhase("uploading");
                              setUploadFileName(file.name);
                              e.target.value = "";
                              try {
                                const duration = await extractDurationFromFile(file);
                                const thumbnail = await extractThumbnailFromFile(file);
                                const { url } = await api.uploadVideo(file, (pct) => {
                                  setUploadProgress(pct);
                                  if (pct >= 100) setUploadPhase("processing");
                                });
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
                                setUploadProgress(0);
                                setUploadPhase("uploading");
                                setUploadFileName("");
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
                      {uploadingVideo && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center gap-3 mb-2">
                            {uploadPhase === "processing" ? (
                              <Loader2 className="h-4 w-4 text-amber-600 shrink-0 animate-spin" />
                            ) : (
                              <FileVideo className="h-4 w-4 text-amber-600 shrink-0" />
                            )}
                            <p className="text-sm text-gray-900 truncate flex-1">
                              {uploadPhase === "processing" ? "Saving to server..." : (uploadFileName || "Uploading...")}
                            </p>
                            {uploadPhase === "uploading" && (
                              <span className="text-xs font-semibold text-amber-700">{uploadProgress}%</span>
                            )}
                          </div>
                          {uploadPhase === "processing" ? (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
                              <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-amber-500" />
                            </div>
                          ) : (
                            <Progress value={uploadProgress} className="h-1.5 bg-amber-100 [&>div]:bg-amber-500" />
                          )}
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={updateLessonMutation.isPending || !editForm.title.trim() || uploadingVideo}
                        >
                          {updateLessonMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 w-6 text-right">{i + 1}.</span>
                        <div className="w-24 h-16 rounded-lg border border-gray-200 flex-shrink-0 overflow-hidden bg-gray-900 relative">
                          {lesson.videoUrl ? (
                            <video
                              src={getSecureVideoSrc(lesson.videoUrl)}
                              preload="metadata"
                              muted
                              className="w-full h-full object-cover"
                              onLoadedData={(e) => {
                                const vid = e.currentTarget;
                                vid.currentTime = 0.5;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          {lesson.duration && (
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white">
                              {lesson.duration}
                            </span>
                          )}
                        </div>
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
                            <span className="flex items-center gap-1.5">
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

        <AlertDialog open={!!deleteSectionTarget} onOpenChange={(open) => !open && setDeleteSectionTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete section</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{deleteSectionTarget?.title}&quot;?
                {deleteSectionTarget && sections.find(s => (s._id || "default") === deleteSectionTarget.sectionId)?.lessons?.length
                  ? " All lessons in this section will also be removed. This cannot be undone."
                  : " This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteSectionTarget && deleteSectionMutation.mutate(deleteSectionTarget.sectionId)}
              >
                {deleteSectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
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
