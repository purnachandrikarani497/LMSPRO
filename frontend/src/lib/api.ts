import { type Course } from "./mockData";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export const mapApiCourseToCourse = (c: ApiCourse): Course => {
  const course: Course = {
    id: String(c._id || c.id || Math.random().toString(36).substr(2, 9)),
    title: c.title || "Untitled Course",
    description: c.description || "",
    instructor: c.instructor || "Instructor",
    category: c.category || "General",
    price: Number(c.price ?? 0),
    rating: Number(c.rating ?? 0),
    students: Number(c.students ?? 0),
    duration: c.duration || "",
    lessons: c.lessons?.length ?? 0,
    lessonItems: c.lessons || [],
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

const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("lms_token");
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(path: string, method: HttpMethod, body?: unknown, retryCount = 0): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };
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
  description: string;
  thumbnail?: string;
  instructor?: string;
  category?: string;
  price?: number;
  rating?: number;
  students?: number;
  duration?: string;
  level?: string;
  lessons?: {
    _id?: string;
    title: string;
    videoUrl?: string;
    content?: string;
    duration?: string;
    resources?: string[];
  }[];
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
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

export interface ApiProgress {
  _id: string;
  course: string;
  lessonsCompleted: string[];
  status: "in_progress" | "completed";
  score: number;
}

export interface ApiCertificate {
  _id: string;
  course: ApiCourse;
  issuedAt: string;
  url?: string;
}

export const api = {
  register(data: { name: string; email: string; password: string; role?: "admin" | "student" }) {
    return request<ApiAuthResponse>("/auth/register", "POST", data);
  },
  login(data: { email: string; password: string }) {
    return request<ApiAuthResponse>("/auth/login", "POST", data);
  },
  me() {
    return request<{ user: ApiUser }>("/auth/me", "GET");
  },
  forgotPassword(email: string) {
    return request<{ message: string; devLink?: string; token?: string }>("/auth/forgot-password", "POST", { email });
  },
  resetPassword(data: { email: string; token: string; newPassword: string }) {
    return request<{ message: string }>("/auth/reset-password", "POST", data);
  },
  getCourses() {
    return request<ApiCourse[]>("/courses", "GET");
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
    thumbnail?: string;
    instructor?: string;
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
    thumbnail?: string;
    instructor?: string;
    category?: string;
    price?: number;
    level?: string;
    isPublished?: boolean;
  }) {
    return request<ApiCourse>(`/courses/${id}`, "PUT", data);
  },
  deleteCourse(id: string) {
    return request<{ message: string }>(`/courses/${id}`, "DELETE");
  },
  addLesson(courseId: string, data: { title: string; videoUrl?: string; content?: string; duration?: string; resources?: string[] }) {
    return request<{ _id: string; title: string }>(`/courses/${courseId}/lessons`, "POST", data);
  },
  updateLesson(courseId: string, lessonId: string, data: { title?: string; videoUrl?: string; content?: string; duration?: string; resources?: string[] }) {
    return request<{ _id: string; title: string }>(`/courses/${courseId}/lessons/${lessonId}`, "PUT", data);
  },
  deleteLesson(courseId: string, lessonId: string) {
    return request<{ message: string }>(`/courses/${courseId}/lessons/${lessonId}`, "DELETE");
  },
  enroll(courseId: string) {
    return request<ApiEnrollment>("/enrollments", "POST", { courseId });
  },
  getEnrollments() {
    return request<ApiEnrollment[]>("/enrollments", "GET");
  },
  getAllEnrollments() {
    return request<ApiAdminEnrollment[]>("/enrollments/all", "GET");
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
  generateCertificate(courseId: string) {
    return request<ApiCertificate>(`/certificates/${courseId}`, "POST");
  },
  getCertificates() {
    return request<ApiCertificate[]>("/certificates", "GET");
  },
  async uploadThumbnail(file: File): Promise<{ url: string; key: string }> {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/upload/thumbnail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Upload failed");
    }
    return response.json();
  },
  async uploadVideo(file: File): Promise<{ url: string; key: string }> {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/upload/video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Upload failed");
    }
    return response.json();
  }
};
