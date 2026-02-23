import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

interface StoredUser {
  name?: string;
  email?: string;
  role?: "admin" | "student";
}

const Profile = () => {
  const { toast } = useToast();
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

  const handleSave = () => {
    if (typeof window === "undefined") return;
    const rawUser = window.localStorage.getItem("lms_user");
    let stored: StoredUser = {};
    if (rawUser) {
      try {
        stored = JSON.parse(rawUser) as StoredUser;
      } catch {
        stored = {};
      }
    }
    const updated: StoredUser = {
      ...stored,
      name: name || stored.name,
      email: email || stored.email
    };
    window.localStorage.setItem("lms_user", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("lms_user_updated"));
    toast({ title: "Profile updated", description: "Your profile details have been updated." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profile – LearnHub LMS</title>
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">My Profile</h1>
        <p className="mt-2 text-muted-foreground">View and edit your basic account details.</p>

        <div className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              className="bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
