import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Video, Clock, Upload, Loader2, Pencil, X, FileVideo, FileText } from "lucide-react";
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

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return true; // empty is valid (optional field)
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

type LessonEdit = { title: string; lessonType: "video" | "pdf"; videoUrl: string; pdfUrl: string };
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
  const [newLesson, setNewLesson] = useState({ title: "", lessonType: "video" as "video" | "pdf", videoUrl: "", pdfUrl: "", duration: "" });
  const [newLessonThumbnail, setNewLessonThumbnail] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadPhase, setUploadPhase] = useState<"uploading" | "processing">("uploading");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonEdit>({ title: "", lessonType: "video", videoUrl: "", pdfUrl: "" });
  const [editThumbnail, setEditThumbnail] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<{ lessonId: string; title: string } | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ sectionId: string; title: string } | null>(null);
  const [announcementDeleteIndex, setAnnouncementDeleteIndex] = useState<number | null>(null);
  
  // Course metadata state
  const [courseSubtitle, setCourseSubtitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseInstructor, setCourseInstructor] = useState("");
  const [instructorPhoto, setInstructorPhoto] = useState("");
  const [instructorTitle, setInstructorTitle] = useState("");
  const [instructorBio, setInstructorBio] = useState("");
  const [announcements, setAnnouncements] = useState<{ title: string; content: string; postedAt?: string }[]>([]);
  const [announcementErrors, setAnnouncementErrors] = useState<{ title?: string; content?: string }[]>([]);
  const [metaErrors, setMetaErrors] = useState<{ description?: string; instructor?: string }>({});
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [previewUploadProgress, setPreviewUploadProgress] = useState(0);
  const [uploadingInstructorPhoto, setUploadingInstructorPhoto] = useState(false);
  const [videoUrlDialogOpen, setVideoUrlDialogOpen] = useState(false);
  const [videoUrlInput, setVideoUrlInput] = useState("");

  const { data: course, isLoading } = useQuery<ApiCourse>({
    queryKey: ["admin-course", id],
    queryFn: () => api.getCourseAdmin(id || ""),
    enabled: !!id
  });

  // Initialize sections from course
  useEffect(() => {
    if (course) {
      setCourseSubtitle(course.subtitle || "");
      setCourseDescription(course.description || "");
      setCourseInstructor(course.instructor || "");
      setInstructorPhoto(course.instructorPhoto || "");
      setInstructorTitle(course.instructorTitle || "");
      setInstructorBio(course.instructorBio || "");
      setAnnouncements(course.announcements || []);
      setPreviewVideoUrl(course.previewVideoUrl || "");

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


  const updateCourseMutation = useMutation({
    mutationFn: async (data: { subtitle?: string; description: string; instructor: string; instructorPhoto?: string; instructorTitle?: string; instructorBio?: string | ""; announcements?: { title: string; content: string; postedAt?: string }[]; previewVideoUrl?: string }) => {
      if (!course) throw new Error("Course not loaded");
      return api.updateCourse(id!, {
        title: course.title,
        subtitle: data.subtitle,
        description: data.description,
        previewVideoUrl: data.previewVideoUrl,
        instructor: data.instructor,
        instructorPhoto: data.instructorPhoto,
        instructorTitle: data.instructorTitle,
        instructorBio: data.instructorBio,
        announcements: data.announcements,
        thumbnail: course.thumbnail,
        category: course.category,
        price: course.price,
        level: course.level,
        isPublished: course.isPublished
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Course details updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-course", id] });
    },
    onError: (err) => {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive"
      });
    }
  });

  const handleSaveMetadata = () => {
    const errors: { description?: string; instructor?: string } = {};

    // Validate Description - allow full text (Udemy-style)
    if (!courseDescription.trim()) {
      errors.description = "Description is required";
    } else if (courseDescription.length > 5000) {
      errors.description = "Description must be under 5000 characters";
    }

    // Validate Instructor Name
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!courseInstructor.trim()) {
      errors.instructor = "Instructor name is required";
    } else if (courseInstructor.length > 80) {
      errors.instructor = "Instructor name must be under 80 characters";
    } else if (!nameRegex.test(courseInstructor)) {
      errors.instructor = "Instructor name can only contain letters and spaces";
    }

    setMetaErrors(errors);

    // Validate announcements
    const annErrors = announcements.map((a) => {
      const e: { title?: string; content?: string } = {};
      if (!a.title.trim()) e.title = "Title is required";
      if (!a.content.trim()) e.content = "Content is required";
      else if (a.content.length > 200) e.content = "Content cannot exceed 200 characters";
      return e;
    });
    setAnnouncementErrors(annErrors);
    const hasAnnErrors = annErrors.some((e) => e.title || e.content);

    if (Object.keys(errors).length === 0 && !hasAnnErrors) {
      if (previewVideoUrl.trim() && !isValidUrl(previewVideoUrl.trim())) {
        toast({ title: "Invalid Preview Video URL", description: "Please enter a valid URL starting with http:// or https://", variant: "destructive" });
        return;
      }
      if (instructorPhoto.trim() && !isValidUrl(instructorPhoto.trim())) {
        toast({ title: "Invalid Photo URL", description: "Please enter a valid URL starting with http:// or https://", variant: "destructive" });
        return;
      }
      updateCourseMutation.mutate({
        subtitle: courseSubtitle.trim(),
        description: courseDescription.trim(),
        instructor: courseInstructor.trim(),
        previewVideoUrl: previewVideoUrl.trim() || undefined,
        instructorPhoto: instructorPhoto.trim() || undefined,
        instructorTitle: instructorTitle.trim() || undefined,
        instructorBio: instructorBio.trim(),
        announcements: announcements.map((a) => ({
          title: a.title.trim(),
          content: a.content.trim(),
          postedAt: a.postedAt
        }))
      });
    }
  };

  const addSectionMutation = useMutation({
    mutationFn: async () => {
      if (!newSection.trim()) {
        throw new Error("Section title is required");
      }
      return api.addSection(id!, { 
        title: newSection.trim()
      });
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
      return api.updateSection(id!, sectionId, { 
        title: title.trim()
      });
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
      const isPdf = newLesson.lessonType === "pdf";
      const base = {
        title: newLesson.title.trim(),
        duration: newLesson.duration.trim() || undefined,
        lessonType: newLesson.lessonType,
        ...(isPdf
          ? { pdfUrl: newLesson.pdfUrl.trim(), videoUrl: undefined }
          : { videoUrl: newLesson.videoUrl.trim(), pdfUrl: undefined })
      };
      if (targetSection === "default") {
        return api.addLesson(id!, base);
      }
      return api.addLessonToSection(id!, targetSection, base);
    },
    onSuccess: () => {
      toast({ title: "Lesson added", description: "The lesson has been saved" });
      setNewLesson({ title: "", lessonType: "video", videoUrl: "", pdfUrl: "", duration: "" });
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
      const isPdf = data.lessonType === "pdf";
      return api.updateLesson(id!, lessonId, {
        title: data.title.trim(),
        lessonType: data.lessonType,
        duration: editDuration.trim() || undefined,
        ...(isPdf
          ? { pdfUrl: data.pdfUrl.trim() || undefined, videoUrl: undefined }
          : { videoUrl: data.videoUrl.trim() || undefined, pdfUrl: undefined })
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

  const startEdit = (lesson: { _id?: string; title: string; lessonType?: string; videoUrl?: string; pdfUrl?: string; duration?: string }) => {
    if (lesson._id) {
      setEditingLessonId(lesson._id);
      const lt = lesson.lessonType === "pdf" || (lesson.pdfUrl && !lesson.videoUrl) ? "pdf" : "video";
      setEditForm({
        title: lesson.title,
        lessonType: lt,
        videoUrl: lesson.videoUrl || "",
        pdfUrl: lesson.pdfUrl || ""
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
                            placeholder="Section title"
                            value={editingSectionTitle}
                            maxLength={100}
                            onChange={(e) => {
                              if (e.target.value.length > 100) {
                                toast({ title: "Max limit reached", description: "Section title cannot exceed 100 characters.", variant: "destructive" });
                                return;
                              }
                              setEditingSectionTitle(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (editingSectionTitle.length >= 100 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey && e.key !== "Enter" && e.key !== "Escape") {
                                e.preventDefault();
                                toast({ title: "Max limit reached", description: "Section title cannot exceed 100 characters.", variant: "destructive" });
                                return;
                              }
                              if (e.key === "Enter") updateSectionMutation.mutate({ 
                                sectionId: sid, 
                                title: editingSectionTitle
                              });
                              if (e.key === "Escape") {
                                setEditingSectionId(null);
                                setEditingSectionTitle("");
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateSectionMutation.mutate({ 
                                sectionId: sid, 
                                title: editingSectionTitle
                              })}
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
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">{section.title}</p>
                          <p className="mt-1 text-xs text-gray-400">{section.lessons?.length ?? 0} lessons</p>
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
                maxLength={100}
                onChange={(e) => {
                  if (e.target.value.length > 100) {
                    toast({ title: "Max limit reached", description: "Section title cannot exceed 100 characters.", variant: "destructive" });
                    return;
                  }
                  setNewSection(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (newSection.length >= 100 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey && e.key !== "Enter") {
                    e.preventDefault();
                    toast({ title: "Max limit reached", description: "Section title cannot exceed 100 characters.", variant: "destructive" });
                    return;
                  }
                  if (e.key === "Enter" && newSection.trim()) {
                    addSectionMutation.mutate();
                  }
                }}
              />
              <Button
                onClick={() => addSectionMutation.mutate()}
                disabled={!newSection.trim() || addSectionMutation.isPending}
                size="sm"
                className="shrink-0"
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
              if (newLesson.title.length > 60) {
                toast({ title: "Invalid title", description: "Lesson title cannot exceed 60 characters.", variant: "destructive" });
                return;
              }
              if (newLesson.lessonType === "video" && !newLesson.videoUrl.trim()) {
                toast({ title: "Video required", description: "Please upload or paste a video URL before adding a lesson", variant: "destructive" });
                return;
              }
              if (newLesson.lessonType === "pdf" && !newLesson.pdfUrl.trim()) {
                toast({ title: "PDF required", description: "Upload a PDF or paste the document URL from the server", variant: "destructive" });
                return;
              }
              const targetSection = selectedSectionId || (sections.length === 0 ? "default" : null);
              if (!targetSection) {
                toast({ title: "Select a section", description: "Please click on a section above to add the lesson to it.", variant: "destructive" });
                return;
              }
              addLessonMutation.mutate();
            }}
          >
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 self-center">Content type:</span>
            <Button
              type="button"
              variant={newLesson.lessonType === "video" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setNewLesson((p) => ({ ...p, lessonType: "video" }))}
            >
              <Video className="h-3.5 w-3.5" />
              Video
            </Button>
            <Button
              type="button"
              variant={newLesson.lessonType === "pdf" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setNewLesson((p) => ({ ...p, lessonType: "pdf" }))}
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Lesson title"
              value={newLesson.title}
              maxLength={60}
              className="focus-visible:ring-2 focus-visible:ring-amber-500"
              onChange={(e) => {
                if (e.target.value.length > 60) {
                  toast({ title: "Max limit reached", description: "Lesson title cannot exceed 60 characters.", variant: "destructive" });
                  return;
                }
                setNewLesson((p) => ({ ...p, title: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (newLesson.title.length >= 60 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  toast({ title: "Max limit reached", description: "Lesson title cannot exceed 60 characters.", variant: "destructive" });
                }
              }}
            />
          </div>

          {/* Video upload field */}
          {newLesson.lessonType === "video" && !uploadingVideo && (
            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium text-gray-700">Video</label>
              <div className="flex gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setVideoUrlInput(newLesson.videoUrl); setVideoUrlDialogOpen(true); }}
                >
                  <Video className="h-3.5 w-3.5" />
                  {newLesson.videoUrl ? "Change Video URL" : "Add Video URL"}
                </Button>
                {newLesson.videoUrl && (
                  <span className="text-xs text-gray-500 truncate max-w-xs">{newLesson.videoUrl}</span>
                )}
              </div>
            </div>
          )}

          {/* PDF upload field */}
          {newLesson.lessonType === "pdf" && !uploadingPdf && (
            <div className="mt-3 space-y-2">
              <label className="text-sm font-medium text-gray-700">PDF</label>
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  id="pdf-upload-input"
                  accept="application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingPdf(true);
                    setUploadProgress(0);
                    setUploadFileName(file.name);
                    try {
                      const { key } = await api.uploadPdf(file, (pct) => setUploadProgress(pct));
                      setNewLesson((p) => ({ ...p, pdfUrl: key }));
                      toast({ title: "PDF uploaded", description: "PDF has been uploaded successfully" });
                    } catch {
                      toast({ title: "Upload failed", description: "Failed to upload PDF", variant: "destructive" });
                    } finally {
                      setUploadingPdf(false);
                      setUploadProgress(0);
                      e.target.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => document.getElementById("pdf-upload-input")?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {newLesson.pdfUrl ? "Change PDF" : "Upload PDF"}
                </Button>
                {newLesson.pdfUrl && (
                  <span className="text-xs text-gray-500 truncate max-w-xs">{uploadFileName || newLesson.pdfUrl}</span>
                )}
              </div>
            </div>
          )}
          {uploadingVideo && newLesson.lessonType === "video" && (
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
          {uploadingPdf && newLesson.lessonType === "pdf" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{uploadFileName || "Uploading PDF..."}</p>
                  <p className="text-xs text-gray-500">Uploading... {uploadProgress}%</p>
                </div>
                <span className="text-sm font-semibold text-amber-700">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="mt-2 h-2 bg-amber-100 [&>div]:bg-amber-500" />
            </div>
          )}
          <Button
            type="submit"
            className="mt-4 gap-2"
            disabled={
              addLessonMutation.isPending ||
              uploadingVideo ||
              uploadingPdf
            }
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
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm font-medium text-gray-700 self-center">Type:</span>
                        <Button
                          type="button"
                          variant={editForm.lessonType === "video" ? "default" : "outline"}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditForm((p) => ({ ...p, lessonType: "video" }))}
                        >
                          <Video className="h-3.5 w-3.5" />
                          Video
                        </Button>
                        <Button
                          type="button"
                          variant={editForm.lessonType === "pdf" ? "default" : "outline"}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditForm((p) => ({ ...p, lessonType: "pdf" }))}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </div>
                      {editForm.lessonType === "video" && editThumbnail && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Video Thumbnail</p>
                          <img src={editThumbnail} alt="thumbnail" className="w-32 h-24 object-cover rounded border border-gray-200" />
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Lesson title"
                          value={editForm.title}
                          maxLength={60}
                          onChange={(e) => {
                            if (e.target.value.length > 60) {
                              toast({ title: "Max limit reached", description: "Lesson title cannot exceed 60 characters.", variant: "destructive" });
                              return;
                            }
                            setEditForm((p) => ({ ...p, title: e.target.value }));
                          }}
                          onKeyDown={(e) => {
                            if (editForm.title.length >= 60 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              toast({ title: "Max limit reached", description: "Lesson title cannot exceed 60 characters.", variant: "destructive" });
                            }
                          }}
                        />
                      </div>
                      {editForm.lessonType === "pdf" && !uploadingPdf && (
                        <div className="space-y-1">
                          <label className="text-sm font-medium text-gray-700">PDF</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="file"
                              id="edit-pdf-upload-input"
                              accept="application/pdf"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingPdf(true);
                                setUploadProgress(0);
                                setUploadFileName(file.name);
                                try {
                                  const { key } = await api.uploadPdf(file, (pct) => setUploadProgress(pct));
                                  setEditForm((p) => ({ ...p, pdfUrl: key }));
                                  toast({ title: "PDF uploaded", description: "PDF has been uploaded successfully" });
                                } catch {
                                  toast({ title: "Upload failed", description: "Failed to upload PDF", variant: "destructive" });
                                } finally {
                                  setUploadingPdf(false);
                                  setUploadProgress(0);
                                  e.target.value = "";
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => document.getElementById("edit-pdf-upload-input")?.click()}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {editForm.pdfUrl ? "Change PDF" : "Upload PDF"}
                            </Button>
                            {editForm.pdfUrl && (
                              <span className="text-xs text-gray-500 truncate max-w-xs">{uploadFileName || editForm.pdfUrl}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {uploadingPdf && editForm.lessonType === "pdf" && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{uploadFileName || "Uploading PDF..."}</p>
                              <p className="text-xs text-gray-500">Uploading... {uploadProgress}%</p>
                            </div>
                            <span className="text-xs font-semibold text-amber-700">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="mt-2 h-1.5 bg-amber-100 [&>div]:bg-amber-500" />
                        </div>
                      )}
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
                          disabled={
                            updateLessonMutation.isPending ||
                            !editForm.title.trim() ||
                            uploadingVideo ||
                            uploadingPdf ||
                            (editForm.lessonType === "video" && !editForm.videoUrl.trim()) ||
                            (editForm.lessonType === "pdf" && !editForm.pdfUrl.trim())
                          }
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
                          {lesson.lessonType === "pdf" || (lesson.pdfUrl && !lesson.videoUrl) ? (
                            <div className="w-full h-full flex items-center justify-center bg-stone-100">
                              <FileText className="h-8 w-8 text-red-600" />
                            </div>
                          ) : lesson.videoUrl ? (
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
                          {lesson.lessonType === "pdf" || (lesson.pdfUrl && !lesson.videoUrl) ? (
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3 w-3" />
                              PDF
                            </span>
                          ) : lesson.videoUrl ? (
                            <span className="flex items-center gap-1.5">
                              <Video className="h-3 w-3" />
                              Video
                            </span>
                          ) : null}
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

        <AlertDialog open={announcementDeleteIndex !== null} onOpenChange={(open) => !open && setAnnouncementDeleteIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove announcement?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the announcement from the list. Save course changes to apply it on the course page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (announcementDeleteIndex !== null) {
                    setAnnouncements((prev) => prev.filter((_, i) => i !== announcementDeleteIndex));
                    setAnnouncementErrors((prev) => prev.filter((_, i) => i !== announcementDeleteIndex));
                  }
                  setAnnouncementDeleteIndex(null);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Video URL Dialog */}
        <AlertDialog open={videoUrlDialogOpen} onOpenChange={(open) => !open && setVideoUrlDialogOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Video URL</AlertDialogTitle>
              <AlertDialogDescription>Paste the video URL below.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="https://..."
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              className="mt-2"
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setVideoUrlDialogOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setNewLesson((p) => ({ ...p, videoUrl: videoUrlInput.trim() }));
                  setVideoUrlDialogOpen(false);
                }}
              >
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Course Metadata Update Section */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Course Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle / Short Description</label>
              <textarea
                value={courseSubtitle}
                onChange={(e) => {
                  if (e.target.value.length > 100) {
                    toast({ title: "Max limit reached", description: "Subtitle cannot exceed 100 characters.", variant: "destructive" });
                    return;
                  }
                  setCourseSubtitle(e.target.value);
                }}
                className="w-full min-h-[60px] p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Enter a short subtitle (e.g. Python for Beginners)"
                maxLength={100}
              />
              <p className="mt-1 text-[10px] text-gray-400">{courseSubtitle.length}/100 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                className={`w-full min-h-[120px] p-2 rounded-md border ${metaErrors.description ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                placeholder="Enter course description (About this course - full text allowed)"
                maxLength={5000}
              />
              {metaErrors.description && <p className="mt-1 text-xs text-red-500">{metaErrors.description}</p>}
              <p className="mt-1 text-[10px] text-gray-400">{courseDescription.length}/5000 characters</p>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Preview Video</h3>
              <p className="text-sm text-gray-500 mb-3">Optional course promo shown on the course page “Preview this course”.</p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="preview-video-upload"
                  accept="video/mp4,video/webm,video/ogg"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingPreview(true);
                    setPreviewUploadProgress(0);
                    try {
                      const { url } = await api.uploadVideo(file, (pct) => setPreviewUploadProgress(pct));
                      setPreviewVideoUrl(url);
                      toast({ title: "Preview uploaded", description: "Preview video URL set" });
                    } catch (err) {
                      toast({
                        title: "Upload failed",
                        description: err instanceof Error ? err.message : "Please try again",
                        variant: "destructive"
                      });
                    } finally {
                      setUploadingPreview(false);
                      setPreviewUploadProgress(0);
                      if (e.target) e.target.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("preview-video-upload")?.click()}
                  disabled={uploadingPreview}
                >
                  {uploadingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploadingPreview ? "Uploading..." : "Upload Preview Video"}
                </Button>
                {previewVideoUrl && (
                  <span className="text-sm text-green-600 truncate max-w-xs">✓ Video uploaded</span>
                )}
              </div>
              {uploadingPreview && (
                <div className="mt-2">
                  <Progress value={previewUploadProgress} className="h-2 bg-amber-100 [&>div]:bg-amber-500" />
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Instructor</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor Name</label>
                  <Input
                    value={courseInstructor}
                    onChange={(e) => setCourseInstructor(e.target.value)}
                    className={metaErrors.instructor ? 'border-red-500' : ''}
                    placeholder="e.g. Mark Shrike"
                    maxLength={80}
                  />
                  {metaErrors.instructor && <p className="mt-1 text-xs text-red-500">{metaErrors.instructor}</p>}
                  <p className="mt-1 text-[10px] text-gray-400">{courseInstructor.length}/80 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructor Photo</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id="instructor-photo-upload"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingInstructorPhoto(true);
                        try {
                          const { url } = await api.uploadThumbnail(file);
                          setInstructorPhoto(url);
                          toast({ title: "Photo uploaded", description: "Instructor photo uploaded successfully" });
                        } catch (err) {
                          toast({
                            title: "Upload failed",
                            description: err instanceof Error ? err.message : "Please try again",
                            variant: "destructive"
                          });
                        } finally {
                          setUploadingInstructorPhoto(false);
                          if (e.target) e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("instructor-photo-upload")?.click()}
                      disabled={uploadingInstructorPhoto}
                    >
                      {uploadingInstructorPhoto ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {uploadingInstructorPhoto ? "Uploading..." : "Upload Photo"}
                    </Button>
                    {instructorPhoto && (
                      <div className="flex items-center gap-2">
                        <img src={instructorPhoto} alt="Instructor" className="h-8 w-8 rounded-full object-cover border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => setInstructorPhoto("")}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Remove photo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title / Tagline</label>
                  <Input
                    value={instructorTitle}
                    maxLength={100}
                    onChange={(e) => {
                      if (e.target.value.length > 100) {
                        toast({ title: "Max limit reached", description: "Title / Tagline cannot exceed 100 characters.", variant: "destructive" });
                        return;
                      }
                      setInstructorTitle(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (instructorTitle.length >= 100 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        toast({ title: "Max limit reached", description: "Title / Tagline cannot exceed 100 characters.", variant: "destructive" });
                      }
                    }}
                    placeholder="e.g. Software Test Engineer (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={instructorBio}
                    onChange={(e) => setInstructorBio(e.target.value)}
                    className="w-full min-h-[80px] p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Instructor biography (optional)"
                    maxLength={2000}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">{instructorBio.length}/2000 characters</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Announcements</h3>
              <p className="text-sm text-gray-500 mb-3">Announcements appear in the Announcements tab on the course page.</p>
              <div className="space-y-3">
                {announcements.map((ann, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-2">
                        <Input
                          value={ann.title}
                          maxLength={100}
                          onChange={(e) => {
                            if (e.target.value.length > 100) {
                              toast({ title: "Max limit reached", description: "Announcement title cannot exceed 100 characters.", variant: "destructive" });
                              return;
                            }
                            setAnnouncements((prev) =>
                              prev.map((a, i) => (i === idx ? { ...a, title: e.target.value } : a))
                            );
                            setAnnouncementErrors((prev) => {
                              const next = [...prev];
                              if (!next[idx]) next[idx] = {};
                              next[idx] = { ...next[idx], title: "" };
                              return next;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (ann.title.length >= 100 && e.key !== "Backspace" && e.key !== "Delete" && e.key !== "Tab" && !e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              toast({ title: "Max limit reached", description: "Announcement title cannot exceed 100 characters.", variant: "destructive" });
                            }
                          }}
                          placeholder="Announcement title"
                          className="font-medium"
                        />
                        {announcementErrors[idx]?.title && (
                          <p className="text-xs text-red-500">{announcementErrors[idx].title}</p>
                        )}
                        <textarea
                          value={ann.content}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.length <= 200) {
                              setAnnouncements((prev) =>
                                prev.map((a, i) => (i === idx ? { ...a, content: val } : a))
                              );
                              setAnnouncementErrors((prev) => {
                                const next = [...prev];
                                if (!next[idx]) next[idx] = {};
                                next[idx] = { ...next[idx], content: "" };
                                return next;
                              });
                            }
                          }}
                          placeholder="Announcement content"
                          className="w-full min-h-[60px] p-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          maxLength={200}
                        />
                        <div className="flex items-center justify-between">
                          {announcementErrors[idx]?.content ? (
                            <p className="text-xs text-red-500">{announcementErrors[idx].content}</p>
                          ) : <span />}
                          <span className={`text-xs ${ann.content.length >= 200 ? "text-red-500" : "text-gray-400"}`}>
                            {ann.content.length}/200
                          </span>
                        </div>
                        {ann.postedAt && (
                          <p className="text-xs text-gray-400">
                            Posted: {new Date(ann.postedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnnouncementDeleteIndex(idx)}
                        className="p-2 rounded text-gray-500 hover:bg-red-100 hover:text-red-600 shrink-0"
                        title="Remove announcement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setAnnouncements((prev) => [...prev, { title: "", content: "", postedAt: new Date().toISOString() }]); setAnnouncementErrors((prev) => [...prev, {}]); }}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add announcement
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                onClick={handleSaveMetadata} 
                disabled={updateCourseMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {updateCourseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCoursePage;
