import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  BookOpenIcon,
  CreditCard,
  Menu,
  X,
  Home,
  GraduationCap
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type UserRole = "admin" | "student";

interface StoredUser {
  role?: UserRole;
}

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const location = useLocation();

  const loadUser = () => {
    try {
      if (typeof window === "undefined") return;
      const rawUser = window.localStorage.getItem("lms_user");
      if (!rawUser) {
        setUser(null);
        return;
      }
      setUser(JSON.parse(rawUser) as StoredUser);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
    window.addEventListener("lms_user_updated", loadUser);
    return () => window.removeEventListener("lms_user_updated", loadUser);
  }, []);

  const baseLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/courses", label: "Courses", icon: BookOpenIcon }
  ];

  const studentLinks = [
    ...baseLinks,
    { to: "/dashboard", label: "My Learning", icon: GraduationCap }
  ];

  const adminLinks = [
    ...baseLinks,
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/payments", label: "Completed Payments", icon: CreditCard }
  ];

  const showSidebar = user?.role === "admin";
  const sidebarLinks = user?.role === "admin" ? adminLinks : user?.role === "student" ? studentLinks : baseLinks;

  const isActive = (link: { to: string }) => {
    if (link.to === "/admin") {
      return location.pathname === "/admin" || (location.pathname.startsWith("/admin/") && !location.pathname.startsWith("/admin/payments"));
    }
    if (link.to === "/admin/payments") return location.pathname === "/admin/payments";
    if (link.to === "/") return location.pathname === "/";
    return location.pathname === link.to || location.pathname.startsWith(link.to + "/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - desktop, fixed position - admin only */}
      {showSidebar && (
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-heading text-lg font-bold text-foreground">LearnHub</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      )}

      {/* Mobile sidebar toggle - admin only */}
      {showSidebar && (
        <>
          <button
            className="fixed left-4 top-20 z-40 rounded-lg border border-border bg-card p-2 lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {sidebarOpen && (
            <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          <aside
            className={`fixed left-0 top-0 z-40 h-full w-64 transform border-r border-border bg-card transition-transform lg:hidden ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-heading text-lg font-bold">LearnHub</span>
              </Link>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {sidebarLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive(link) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main content - offset for sidebar on desktop when admin */}
      <main className={`min-w-0 flex-1 flex flex-col ${showSidebar ? "lg:ml-64" : ""}`}>
        <Navbar showFullNav={!showSidebar} />
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default MainLayout;
