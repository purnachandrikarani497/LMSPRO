import { type Course } from "./mockData";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const getUserRoleFromToken = (): "admin" | "student" | null => {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("lms_token");
  if (!token) return null;
  
  try {
    // JWT format: header.payload.signature
    const payload = token.split(".")[1];
    if (!payload) return null;
    
    // Decode base64url
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.role || null;
  } catch {
    return null;
  }
};

export const getUserIdFromToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("lms_token");
  if (!token) return null;
  
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded.sub || null; // JWT usually uses 'sub' for the user ID
  } catch {
    return null;
  }
};

export const mapApiCourseToCourse = (c: ApiCourse): Course => {
  // Flatten lessons from sections if they exist, otherwise use flat lessons array
  let allLessons = c.lessons || [];
  if (c.sections && c.sections.length > 0) {
    allLessons = c.sections.flatMap(s => s.lessons || []);
  }
  
  const course: Course = {
    id: String(c._id || c.id || Math.random().toString(36).substr(2, 9)),
    title: c.title || "Untitled Course",
    subtitle: c.subtitle || "",
    description: c.description || "",
    instructor: c.instructor || "Instructor",
    category: c.category || "General",
    price: Number(c.price ?? 0),
    rating: c.rating || 0,
    ratingCount: c.ratingCount || (c.reviews?.length || 0),
    students: c.students || 0,
    duration: c.duration || "",
    lessons: allLessons.length,
    lessonItems: allLessons,
    level: (c.level as Course["level"]) || "Beginner",
    image: c.thumbnail || "",
    featured: false
  };
  return course;
};

export function getThumbnailSrc(thumbnail: string | undefined): string {
  if (!thumbnail) return "";
  
  // 1. Handle blob URLs (previews)
  if (thumbnail.startsWith("blob:")) return thumbnail;

  // 2. Handle proxy URLs (already processed)
  if (thumbnail.includes("/upload/thumb") || thumbnail.includes("/upload/proxy")) {
    return thumbnail;
  }

  // 3. Handle S3 keys (e.g., "thumbnails/uuid.jpg")
  if (thumbnail.startsWith("thumbnails/")) {
    return `${API_BASE_URL}/upload/thumb?key=${encodeURIComponent(thumbnail)}`;
  }
    
  // 4. Handle HTTP/HTTPS URLs
  if (thumbnail.startsWith("http")) {
    try {
      const url = new URL(thumbnail);
      const path = url.pathname;
      const host = url.hostname.toLowerCase();
      
      // Allow local/uploads served by our backend without proxying
      if (host.includes("localhost") || host === "127.0.0.1") {
        return thumbnail;
      }
      
      // Extract key from S3 URL and proxy via backend
      const keyMatch = path.match(/(thumbnails\/[^?]+)/);
      if (keyMatch) {
        return `${API_BASE_URL}/upload/thumb?key=${encodeURIComponent(keyMatch[1])}`;
      }
      
      // Direct access for public CDNs
      if (host.includes("unsplash.com") || host.includes("imgur.com")) {
        return thumbnail;
      }
      
      // Proxy for other S3/external URLs to handle potential private access/CORS
      return `${API_BASE_URL}/upload/proxy?url=${encodeURIComponent(thumbnail)}`;
    } catch {
      return thumbnail;
    }
  }
  
  // 5. Handle potential raw filenames
  if (thumbnail.includes(".") && !thumbnail.includes("/")) {
     return `${API_BASE_URL}/upload/thumb?key=${encodeURIComponent("thumbnails/" + thumbnail)}`;
  }

  return thumbnail;
}

export function getVideoSrc(videoUrl: string | undefined): string {
  if (!videoUrl) return "";
  if (videoUrl.startsWith("videos/")) {
    return `${API_BASE_URL}/upload/video?key=${encodeURIComponent(videoUrl)}`;
  }
  try {
    const url = new URL(videoUrl);
    if (url.pathname.includes("/upload/video") && url.searchParams.has("key")) {
      const key = url.searchParams.get("key");
      if (key?.startsWith("videos/")) {
        return `${API_BASE_URL}/upload/video?key=${encodeURIComponent(key)}`;
      }
    }
  } catch {
    /* ignore */
  }
  return videoUrl;
}

/** Returns lesson-based stream URL (hides video key, requires enrollment) */
export function getSecureStreamUrl(courseId: string, lessonId: string): string {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("lms_token") : null;
  const url = `${API_BASE_URL}/upload/stream/lesson/${courseId}/${lessonId}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/** Returns lesson-based PDF stream URL (enrollment + auth; use in iframe src) */
export function getSecurePdfUrl(courseId: string, lessonId: string): string {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("lms_token") : null;
  const url = `${API_BASE_URL}/upload/stream/pdf/${courseId}/${lessonId}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/** Returns HLS master playlist URL with auth token */
export function getHlsUrl(hlsKey: string): string {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("lms_token") : null;
  const url = `${API_BASE_URL}/upload/hls/${hlsKey}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/** Returns video URL with auth token for protected streaming (backend validates token) */
export function getSecureVideoSrc(videoUrl: string | undefined): string {
  if (!videoUrl) return "";
  const token = typeof window !== "undefined" ? window.localStorage.getItem("lms_token") : null;
  const base = getVideoSrc(videoUrl);
  if (!base) return "";
  // For our backend proxy URLs, append token so backend can validate
  if (base.includes("/upload/video")) {
    const sep = base.includes("?") ? "&" : "?";
    return token ? `${base}${sep}token=${encodeURIComponent(token)}` : base;
  }
  return base;
}

const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("lms_token");
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(path: string, method: HttpMethod, body?: unknown, retryCount = 0): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("lms_token");
          window.localStorage.removeItem("lms_user");
          window.dispatchEvent(new Event("lms_user_updated"));
          if (!window.location.pathname.startsWith("/auth")) {
            window.location.assign("/auth?tab=signin");
          }
        }
      } catch {
        /* ignore */
      }
      throw new Error(text || "Unauthorized");
    }
    if (response.status === 503 && retryCount < 2) {
      try {
        const data = JSON.parse(text);
        if (data?.code === "DB_DISCONNECTED") {
          await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
          return request<T>(path, method, body, retryCount + 1);
        }
      } catch {
        /* ignore */
      }
    }
    throw new Error(text || "Request failed");
  }
  return response.json() as Promise<T>;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "admin" | "student";
}

export interface ApiAuthResponse {
  user: ApiUser;
  token: string;
}

export interface ApiCourse {
  _id?: string;
  id?: string;
  title: string;
  subtitle?: string;
  description: string;
  thumbnail?: string;
  previewVideoUrl?: string;
  instructor?: string;
  instructorPhoto?: string;
  instructorTitle?: string;
  instructorBio?: string;
  category?: string;
  price?: number;
  rating?: number;
  ratingCount?: number;
  students?: number;
  reviews?: any[];
  duration?: string;
  level?: string;
  isPublished?: boolean;
  lessons?: {
    _id?: string;
    title: string;
    lessonType?: "video" | "pdf";
    videoUrl?: string;
    pdfUrl?: string;
    content?: string;
    duration?: string;
  }[];
  sections?: {
    _id?: string;
    title: string;
    lessons?: {
      _id?: string;
      title: string;
      lessonType?: "video" | "pdf";
      videoUrl?: string;
      pdfUrl?: string;
      content?: string;
      duration?: string;
    }[];
  }[];
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
  announcements?: {
    title: string;
    content: string;
    postedAt?: string;
  }[];
}

export interface ApiEnrollment {
  _id: string;
  course: ApiCourse;
}

export interface ApiAdminEnrollment extends ApiEnrollment {
  student: {
    _id: string;
    name?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApiAdminUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  enrollmentsCount: number;
  enrollments: { course?: string; price?: number; enrolledAt?: string }[];
  progress: { course?: string; lessonsCompleted: number; status: string; lastActivity?: string }[];
}

export interface ApiSettings {
  clientUrl?: string;
  adminEmail?: string;
  razorpayConfigured?: boolean;
  smtpConfigured?: boolean;
}

export interface ApiCategory {
  _id: string;
  name: string;
  icon?: string;
  slug?: string;
}

export interface ApiProgress {
  _id: string;
  course: string;
  lessonsCompleted: string[];
  watchTimestamps?: Record<string, number>;
  lessonDurations?: Record<string, number>;
  status: "in_progress" | "completed";
  score: number;
}

export interface ApiNoteEntry {
  text: string;
  createdAt: string;
  videoTimestamp?: number;
}

export interface ApiWatchTimestamps {
  timestamps: Record<string, number>;
  durations: Record<string, number>;
  notes?: Record<string, ApiNoteEntry[]>;
}

export interface ApiVideoStatus {
  status: "none" | "pending" | "processing" | "ready" | "failed";
  hlsKey?: string;
  qualities?: string[];
  error?: string;
}

export interface ApiCertificate {
  _id: string;
  course: ApiCourse;
  issuedAt: string;
  url?: string;
}

function uploadWithProgress(url: string, file: File, onProgress?: (pct: number) => void): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject(new Error("Not authenticated"));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export const api = {
  register(data: { name: string; email: string; phone: string; password: string; role?: "admin" | "student" }) {
    return request<ApiAuthResponse>("/auth/register", "POST", data);
  },
  login(data: { email: string; password: string }) {
    return request<ApiAuthResponse>("/auth/login", "POST", data);
  },
  googleAuth(credential: string) {
    return request<ApiAuthResponse>("/auth/google", "POST", { credential });
  },
  me() {
    return request<{ user: ApiUser }>("/auth/me", "GET");
  },
  updateProfile(data: { name?: string; email?: string; phone?: string }) {
    return request<{ user: ApiUser }>("/auth/me", "PATCH", data);
  },
  forgotPassword(email: string) {
    return request<{ message: string; devLink?: string; token?: string }>("/auth/forgot-password", "POST", { email });
  },
  resetPassword(data: { email: string; token: string; newPassword: string }) {
    return request<{ message: string }>("/auth/reset-password", "POST", data);
  },
  async getCourses(): Promise<ApiCourse[]> {
    try {
      return await request<ApiCourse[]>("/courses", "GET");
    } catch (error) {
      console.error("Error in getCourses:", error);
      throw error;
    }
  },
  getCourse(id: string) {
    return request<ApiCourse>(`/courses/${id}`, "GET");
  },
  getCourseAdmin(id: string) {
    return request<ApiCourse>(`/courses/${id}/admin`, "GET");
  },
  createCourse(data: {
    title: string;
    description: string;
    subtitle?: string;
    thumbnail?: string;
    instructor?: string;
    instructorPhoto?: string;
    instructorTitle?: string;
    instructorBio?: string;
    category?: string;
    price?: number;
    level?: string;
    isPublished?: boolean;
  }) {
    return request<ApiCourse>("/courses", "POST", data);
  },
  updateCourse(id: string, data: {
    title: string;
    description: string;
    subtitle?: string;
    thumbnail?: string;
    previewVideoUrl?: string;
    instructor?: string;
    instructorPhoto?: string;
    instructorTitle?: string;
    instructorBio?: string;
    category?: string;
    price?: number;
    level?: string;
    isPublished?: boolean;
    announcements?: { title: string; content: string; postedAt?: string }[];
  }) {
    return request<ApiCourse>(`/courses/${id}`, "PUT", data);
  },
  deleteCourse(id: string) {
    return request<{ message: string }>(`/courses/${id}`, "DELETE");
  },
  addLesson(courseId: string, data: { title: string; lessonType?: "video" | "pdf"; videoUrl?: string; pdfUrl?: string; content?: string; duration?: string }) {
    return request<{ _id: string; title: string }>(`/courses/${courseId}/lessons`, "POST", data);
  },
  addSection(courseId: string, data: { title: string }) {
    return request<{ _id: string; title: string; lessons: any[] }>(`/courses/${courseId}/sections`, "POST", data);
  },
  addLessonToSection(courseId: string, sectionId: string, data: { title: string; lessonType?: "video" | "pdf"; videoUrl?: string; pdfUrl?: string; content?: string; duration?: string }) {
    return request<{ _id: string; title: string }>(`/courses/${courseId}/sections/${sectionId}/lessons`, "POST", data);
  },
  updateSection(courseId: string, sectionId: string, data: { title: string }) {
    return request<{ _id: string; title: string; lessons: any[] }>(`/courses/${courseId}/sections/${sectionId}`, "PUT", data);
  },
  deleteSection(courseId: string, sectionId: string) {
    return request<{ message: string }>(`/courses/${courseId}/sections/${sectionId}`, "DELETE");
  },
  updateLesson(courseId: string, lessonId: string, data: { title?: string; lessonType?: "video" | "pdf"; videoUrl?: string; pdfUrl?: string; content?: string; duration?: string }) {
    return request<{ _id: string; title: string }>(`/courses/${courseId}/lessons/${lessonId}`, "PUT", data);
  },
  deleteLesson(courseId: string, lessonId: string) {
    return request<{ message: string }>(`/courses/${courseId}/lessons/${lessonId}`, "DELETE");
  },
  enroll(courseId: string) {
    return request<{
      orderId: string;
      amount: number;
      currency: string;
      key: string;
      courseId: string;
    }>("/enrollments", "POST", { courseId });
  },
  verifyPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    courseId: string;
  }) {
    return request<ApiEnrollment>("/enrollments/verify", "POST", data);
  },
  getEnrollments() {
    return request<ApiEnrollment[]>("/enrollments", "GET");
  },
  getAllEnrollments() {
    return request<ApiAdminEnrollment[]>("/enrollments/all", "GET");
  },
  getAllUsers() {
    return request<ApiAdminUser[]>("/users", "GET");
  },
  getSettings() {
    return request<ApiSettings>("/settings", "GET");
  },
  getCategories() {
    return request<ApiCategory[]>("/categories", "GET");
  },
  seedCategories() {
    return request<{ message: string; created: ApiCategory[] }>("/settings/categories/seed", "POST");
  },
  createCategory(data: { name: string; icon?: string }) {
    return request<ApiCategory>("/categories", "POST", data);
  },
  updateCategory(id: string, data: { name: string; icon?: string }) {
    return request<ApiCategory>(`/categories/${id}`, "PUT", data);
  },
  deleteCategory(id: string) {
    return request<{ message: string }>(`/categories/${id}`, "DELETE");
  },
  getProgress(courseId: string) {
    return request<ApiProgress>(`/progress/${courseId}`, "GET");
  },
  completeLesson(courseId: string, lessonId: string) {
    return request<ApiProgress>(`/progress/${courseId}/lessons/${lessonId}/complete`, "POST");
  },
  submitQuiz(courseId: string, answers: number[]) {
    return request<{ score: number; progress: ApiProgress }>(`/progress/${courseId}/quiz/submit`, "POST", {
      answers
    });
  },
  saveWatchTimestamp(courseId: string, lessonId: string, timestamp: number, duration?: number) {
    return request<{ lessonId: string; timestamp: number; autoCompleted?: boolean }>(`/progress/${courseId}/lessons/${lessonId}/timestamp`, "POST", {
      timestamp,
      ...(duration != null ? { duration } : {})
    });
  },
  getWatchTimestamps(courseId: string) {
    return request<ApiWatchTimestamps>(`/progress/${courseId}/timestamps`, "GET");
  },
  saveNote(courseId: string, lessonId: string, note: string, videoTimestamp?: number) {
    return request<{ lessonId: string; note: ApiNoteEntry[] }>(`/progress/${courseId}/lessons/${lessonId}/note`, "POST", { note, videoTimestamp });
  },
  updateNote(courseId: string, lessonId: string, noteIndex: number, note: string) {
    return request<{ lessonId: string; note: ApiNoteEntry[] }>(`/progress/${courseId}/lessons/${lessonId}/notes/${noteIndex}`, "PUT", { note });
  },
  deleteNote(courseId: string, lessonId: string, noteIndex: number) {
    return request<{ lessonId: string; note: ApiNoteEntry[] }>(`/progress/${courseId}/lessons/${lessonId}/notes/${noteIndex}`, "DELETE");
  },
  generateCertificate(courseId: string) {
    return request<ApiCertificate>(`/certificates/${courseId}`, "POST");
  },
  getCertificates() {
    return request<ApiCertificate[]>("/certificates", "GET");
  },
  submitReview(courseId: string, data: { rating: number; comment: string }) {
    return request<ApiCourse>(`/courses/${courseId}/reviews`, "POST", data);
  },
  async uploadThumbnail(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; key: string }> {
    return uploadWithProgress(`${API_BASE_URL}/upload/thumbnail`, file, onProgress);
  },
  async uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; key: string }> {
    return uploadWithProgress(`${API_BASE_URL}/upload/video`, file, onProgress);
  },
  async uploadPdf(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; key: string }> {
    return uploadWithProgress(`${API_BASE_URL}/upload/pdf`, file, onProgress);
  },
  getVideoStatus(key: string) {
    return request<ApiVideoStatus>(`/upload/video-status?key=${encodeURIComponent(key)}`, "GET");
  },
  retranscode(key: string) {
    return request<{ message: string }>("/upload/retranscode", "POST", { key });
  }
};
