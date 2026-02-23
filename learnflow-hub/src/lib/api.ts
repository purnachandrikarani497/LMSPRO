const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3011/api";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("lms_token");
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
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
  getCourses() {
    return request<ApiCourse[]>("/courses", "GET");
  },
  getCourse(id: string) {
    return request<ApiCourse>(`/courses/${id}`, "GET");
  },
  createCourse(data: {
    title: string;
    description: string;
    thumbnail?: string;
    instructor?: string;
    category?: string;
    price?: number;
    level?: string;
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
  }) {
    return request<ApiCourse>(`/courses/${id}`, "PUT", data);
  },
  deleteCourse(id: string) {
    return request<{ message: string }>(`/courses/${id}`, "DELETE");
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
  }
};
