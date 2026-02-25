import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Menu, X, User, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type UserRole = "admin" | "student";

interface StoredUser {
  name?: string;
  email?: string;
  role: UserRole;
}

interface NavbarProps {
  /** When true, show logo and nav links (Home, Courses, etc.). When false, compact nav for admin sidebar layout. */
  showFullNav?: boolean;
}

const Navbar = ({ showFullNav = true }: NavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<StoredUser | null>(null);

  const links = showFullNav
    ? user?.role === "admin"
      ? [
          { to: "/", label: "Home" },
          { to: "/courses", label: "Courses" },
          { to: "/admin", label: "Admin" }
        ]
      : user?.role === "student"
        ? [
            { to: "/", label: "Home" },
            { to: "/courses", label: "Courses" },
            { to: "/dashboard", label: "My Learning" }
          ]
        : [
            { to: "/", label: "Home" },
            { to: "/courses", label: "Courses" }
          ]
    : [];

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadUser = () => {
      const rawUser = window.localStorage.getItem("lms_user");
      if (!rawUser) {
        setUser(null);
        return;
      }
      try {
        const parsed = JSON.parse(rawUser) as StoredUser;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    };

    loadUser();

    const handleUserUpdated = () => {
      loadUser();
    };

    window.addEventListener("lms_user_updated", handleUserUpdated);

    return () => {
      window.removeEventListener("lms_user_updated", handleUserUpdated);
    };
  }, []);

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("lms_token");
      window.localStorage.removeItem("lms_user");
    }
    navigate("/auth?tab=signin");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {showFullNav ? (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">LearnHub</span>
          </Link>
        ) : (
          <div />
        )}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20">
                  <User className="h-4 w-4 text-secondary" />
                </div>
                <span className="max-w-[140px] truncate">
                  {user.name || user.email}
                </span>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
              <Link to="/auth?tab=signup">
                <Button size="sm" className="bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 py-4 md:hidden animate-fade-in">
          {links.length > 0 && (
            <div className="space-y-1 pb-4">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {user ? (
              <>
                <Link to="/profile" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </Button>
                </Link>
                <Button
                  size="sm"
                  className="w-full flex-1"
                  variant="destructive"
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                </Link>
                <Link to="/auth?tab=signup" className="flex-1" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full bg-gradient-gold text-primary">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
