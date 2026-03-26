import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Menu, X, User, LogIn, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type UserRole = "admin" | "student";

interface StoredUser {
  name?: string;
  email?: string;
  role: UserRole;
}

interface NavbarProps {
  showFullNav?: boolean;
  adminMenuToggle?: { open: boolean; onToggle: () => void };
}

const Navbar = ({ showFullNav = true, adminMenuToggle }: NavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<StoredUser | null>(null);

  const links = showFullNav
    ? user?.role === "admin"
      ? [
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
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-card/90 backdrop-blur-xl shadow-sm">
      <div className={`${showFullNav ? "container mx-auto" : "w-full"} flex h-16 items-center px-4 sm:px-6 justify-between`}>
        {showFullNav ? (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">LearnHub</span>
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-heading text-xl font-bold text-foreground">LearnHub</span>
          </Link>
        )}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                location.pathname === link.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {showFullNav && (
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/20">
                      <User className="h-4 w-4 text-secondary" />
                    </div>
                    <span className="max-w-[140px] truncate">
                      {user.name || user.email}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[12rem]">
                  {user.role === "admin" && (
                    <DropdownMenuItem onSelect={() => navigate("/admin/settings")} className="gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => navigate("/profile")} className="gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut} className="gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        )}
        {!showFullNav && adminMenuToggle && (
          <button
            className="md:hidden rounded-md border border-border bg-card/90 p-2 shadow-sm text-foreground"
            aria-label="Toggle menu"
            onClick={adminMenuToggle.onToggle}
          >
            {adminMenuToggle.open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}

        {showFullNav && (
          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        )}
      </div>

      {showFullNav && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="md:hidden w-[50vw] max-w-[20rem] bg-card p-0 border-r border-border"
          >
            <div className="flex h-[100svh] flex-col">
              {links.length > 0 && (
                <div className="space-y-1 p-4 flex-1">
                  {links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-auto flex flex-col gap-2 p-4 border-t border-border">
                {user ? (
                  <>
                    {user.role === "admin" && (
                      <Link to="/admin/settings" onClick={() => setMobileOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full gap-2">
                          <Settings className="h-4 w-4" />
                          Settings
                        </Button>
                      </Link>
                    )}
                    <Link to="/profile" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <User className="h-4 w-4" />
                        Profile
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="w-full"
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
                    <Link to="/auth" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                    </Link>
                    <Link to="/auth?tab=signup" onClick={() => setMobileOpen(false)}>
                      <Button size="sm" className="w-full bg-gradient-gold text-primary">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
};

export default Navbar;
