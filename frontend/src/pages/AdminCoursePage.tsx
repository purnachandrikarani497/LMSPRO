import { useState } from "react";
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

type LessonEdit = { title: string; duration: string; videoUrl: string };

const AdminCoursePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLesson, setNewLesson] = useState({ title: "", duration: "", videoUrl: "" });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<LessonEdit>({ title: "", duration: "", videoUrl: "" });
  const [deleteTarget, setDeleteTarget] = useState<{ lessonId: string; title: string } | null>(null);

  const { data: course, isLoading } = useQuery<ApiCourse>({
    queryKey: ["admin-course", id],
    queryFn: () => api.getCourseAdmin(id || ""),
    enabled: !!id
  });

  const addLessonMutation = useMutation({
    mutationFn: () =>
      api.addLesson(id!, {
        title: newLesson.title.trim(),
        duration: newLesson.duration.trim() || undefined,
        videoUrl: newLesson.videoUrl.trim() || undefined
      }),
    onSuccess: () => {
      toast({ title: "Lesson added", description: "The lesson has been saved" });
      setNewLesson({ title: "", duration: "", videoUrl: "" });
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
    mutationFn: ({ lessonId, data }: { lessonId: string; data: LessonEdit }) =>
      api.updateLesson(id!, lessonId, {
        title: data.title.trim(),
        duration: data.duration.trim() || undefined,
        videoUrl: data.videoUrl.trim() || undefined
      }),
    onSuccess: () => {
      toast({ title: "Lesson updated", description: "Changes have been saved" });
      setEditingLessonId(null);
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

  const startEdit = (lesson: { _id?: string; title: string; duration?: string; videoUrl?: string }) => {
    if (lesson._id) {
      setEditingLessonId(lesson._id);
      setEditForm({
        title: lesson.title,
        duration: lesson.duration || "",
        videoUrl: lesson.videoUrl || ""
      });
    }
  };

  const cancelEdit = () => {
    setEditingLessonId(null);
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

        {/* Add Lesson */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Add Lesson</h2>
          <p className="mt-1 text-sm text-gray-600">Add lessons to display in the course sidebar (Udemy-style)</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Input
              placeholder="Lesson title"
              value={newLesson.title}
              onChange={(e) => setNewLesson((p) => ({ ...p, title: e.target.value }))}
            />
            <Input
              placeholder="Duration (e.g. 7 min)"
              value={newLesson.duration}
              onChange={(e) => setNewLesson((p) => ({ ...p, duration: e.target.value }))}
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
                    const { url } = await api.uploadVideo(file);
                    setNewLesson((p) => ({ ...p, videoUrl: url }));
                    toast({ title: "Video uploaded", description: "Video URL added" });
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

        {/* Lessons List */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900">Course Content ({lessons.length} lessons)</h2>
          <p className="mt-1 text-sm text-gray-600">These appear in the course sidebar on the course detail page</p>
          {lessons.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {lessons.map((lesson, i) => (
                <li
                  key={lesson._id || i}
                  className="rounded border border-gray-100 bg-gray-50/50 px-4 py-3"
                >
                  {editingLessonId === lesson._id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          placeholder="Lesson title"
                          value={editForm.title}
                          onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                        />
                        <Input
                          placeholder="Duration (e.g. 7 min)"
                          value={editForm.duration}
                          onChange={(e) => setEditForm((p) => ({ ...p, duration: e.target.value }))}
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
                                const { url } = await api.uploadVideo(file);
                                setEditForm((p) => ({ ...p, videoUrl: url }));
                                toast({ title: "Video uploaded", description: "Video URL updated" });
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
                      <span className="text-sm font-medium text-gray-500">{i + 1}.</span>
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
            <p className="mt-6 py-8 text-center text-gray-500">No lessons yet. Add lessons above.</p>
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
