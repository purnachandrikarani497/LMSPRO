import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { api } from "@/lib/api";

interface StoredUser {
  name?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "student";
}

const phoneMaxLength = 15;

const Profile = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser = window.localStorage.getItem("lms_user");
    if (!rawUser) return;
    try {
      const parsed = JSON.parse(rawUser) as StoredUser;
      if (parsed.name) setName(parsed.name);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.phone) setPhone(parsed.phone);
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleNameChange = (value: string) => {
    if (value.length > 50) {
      toast({
        title: "Max limit reached",
        description: "Full Name cannot exceed 50 characters.",
        variant: "destructive",
      });
      return;
    }

    if (value && !/^[a-zA-Z\s]+$/.test(value)) {
      toast({
        title: "Invalid character",
        description: "Name can only contain characters",
        variant: "destructive",
      });
      return;
    }
    
    setName(value);
  };

  const handleEmailChange = (value: string) => {
    if (value.length > 50) {
      toast({
        title: "Max limit reached",
        description: "Email cannot exceed 50 characters.",
        variant: "destructive",
      });
      return;
    }

    setEmail(value);
  };

  const handleSave = async () => {
    if (typeof window === "undefined") return;

    if (!name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Missing Email",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    if (!email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Email must contain @ character.",
        variant: "destructive",
      });
      return;
    }

    if (!phone.trim()) {
      toast({
        title: "Phone required",
        description: "Please enter your phone number.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[\d\s+-]{10,}$/.test(phone.trim())) {
      toast({
        title: "Invalid phone",
        description: "Enter a valid 10-digit phone number.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const rawUser = window.localStorage.getItem("lms_user");
      let stored: StoredUser = {};
      if (rawUser) {
        try {
          stored = JSON.parse(rawUser) as StoredUser;
        } catch {
          stored = {};
        }
      }

      const updated = { ...stored, name: name.trim(), email: email.trim(), phone: phone.trim() };

      if (stored.id === "admin-static" || stored.role === "admin") {
        window.localStorage.setItem("lms_user", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("lms_user_updated"));
        toast({ title: "Profile updated", description: "Admin profile saved locally." });
      } else {
        const res = await api.updateProfile({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim()
        });
        const saved = { ...stored, ...res.user };
        window.localStorage.setItem("lms_user", JSON.stringify(saved));
        window.dispatchEvent(new CustomEvent("lms_user_updated"));
        toast({ title: "Profile updated", description: "Your changes have been saved." });
      }
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profile – LearnHub LMS</title>
      </Helmet>
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">My Profile</h1>
        <p className="mt-2 text-muted-foreground">View and edit your basic account details.</p>

        <form
          className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-card"
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Full Name</label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Email</label>
            <Input
              type="text"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Phone number</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, phoneMaxLength))}
              placeholder="e.g. +91 9876543210"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Profile;
