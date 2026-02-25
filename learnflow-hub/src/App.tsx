import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "@/pages/Index";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import StudentDashboard from "@/pages/StudentDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import LessonViewer from "@/pages/LessonViewer";
import QuizPage from "@/pages/QuizPage";
import Payment from "@/pages/Payment";
import Certificates from "@/pages/Certificates";
import Pricing from "@/pages/Pricing";
import ForBusiness from "@/pages/ForBusiness";
import About from "@/pages/About";
import Careers from "@/pages/Careers";
import Blog from "@/pages/Blog";
import HelpCenter from "@/pages/HelpCenter";
import Contact from "@/pages/Contact";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient();

type UserRole = "admin" | "student";

interface StoredUser {
  role: UserRole;
}

interface ProtectedProps {
  children: JSX.Element;
  role?: UserRole;
}

const getAuthState = () => {
  if (typeof window === "undefined") {
    return { token: null as string | null, user: null as StoredUser | null };
  }
  const token = window.localStorage.getItem("lms_token");
  const rawUser = window.localStorage.getItem("lms_user");
  let user: StoredUser | null = null;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as StoredUser;
    } catch {
      user = null;
    }
  }
  return { token, user };
};

const ProtectedRoute = ({ children, role }: ProtectedProps) => {
  const { token, user } = getAuthState();
  if (!token || !user) {
    return <Navigate to="/auth?tab=signin" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/for-business" element={<ForBusiness />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/help-center" element={<HelpCenter />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route
              path="/course/:courseId/lesson/:lessonId"
              element={
                <ProtectedRoute role="student">
                  <LessonViewer />
                </ProtectedRoute>
              }
            />
            <Route
              path="/course/:courseId/payment"
              element={
                <ProtectedRoute role="student">
                  <Payment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/course/:courseId/quiz"
              element={
                <ProtectedRoute role="student">
                  <QuizPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/certificates"
              element={
                <ProtectedRoute role="student">
                  <Certificates />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
