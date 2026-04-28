import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Helmet } from "react-helmet-async";

interface StoredUser {
  name?: string;
  email?: string;
  role?: "admin" | "student";
}

const Profile = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser = window.localStorage.getItem("lms_user");
    if (!rawUser) return;
    try {
      const parsed = JSON.parse(rawUser) as StoredUser;
      if (parsed.name) setName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profile – LearnHub LMS</title>
      </Helmet>
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">My Profile</h1>
        <p className="mt-2 text-muted-foreground">View your basic account details.</p>

        <div className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Full Name</label>
            <Input
              value={name}
              readOnly
              className="cursor-default bg-muted text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Email</label>
            <Input
              value={email}
              readOnly
              className="cursor-default bg-muted text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
