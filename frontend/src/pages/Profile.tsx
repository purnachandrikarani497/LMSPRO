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

const NAME_MAX = 50;
const EMAIL_MAX = 60;
const PHONE_DIGITS = 10;

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
      if (parsed.name) setName(parsed.name.slice(0, NAME_MAX));
      if (parsed.email) setEmail(parsed.email.slice(0, EMAIL_MAX));
      if (parsed.phone) setPhone(parsed.phone.replace(/\D/g, "").slice(0, PHONE_DIGITS));
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleNameChange = (value: string) => {
    if (value.length > NAME_MAX) return;
    if (value && !/^[a-zA-Z\s]+$/.test(value)) {
      toast({ title: "Invalid character", description: "Name can only contain letters and spaces.", variant: "destructive" });
      return;
    }
    setName(value);
  };

  const handleEmailChange = (value: string) => {
    if (value.length > EMAIL_MAX) return;
    setEmail(value);
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PHONE_DIGITS);
    if (digits.length > 0 && !/^[6-9]/.test(digits)) return;
    setPhone(digits);
  };

  const handleSave = async () => {
    if (typeof window === "undefined") return;

    if (!name.trim()) {
      toast({ title: "Missing Name", description: "Please enter your full name.", variant: "destructive" });
      return;
    }
    if (name.length > NAME_MAX) {
      toast({ title: "Name too long", description: `Full name cannot exceed ${NAME_MAX} characters.`, variant: "destructive" });
      return;
    }

    if (!email.trim()) {
      toast({ title: "Missing Email", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    if (email.length > EMAIL_MAX) {
      toast({ title: "Email too long", description: `Email cannot exceed ${EMAIL_MAX} characters.`, variant: "destructive" });
      return;
    }
    if (!email.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address (e.g. you@example.com).", variant: "destructive" });
      return;
    }

    if (!phone.trim()) {
      toast({ title: "Phone required", description: "Please enter your phone number.", variant: "destructive" });
      return;
    }
    if (phone.replace(/\D/g, "").length !== PHONE_DIGITS) {
      toast({ title: "Invalid phone", description: "Phone number must be exactly 10 digits.", variant: "destructive" });
      return;
    }
    if (!/^[6-9]/.test(phone)) {
      toast({ title: "Invalid phone", description: "Phone number must start with 6, 7, 8, or 9.", variant: "destructive" });
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

      const updated = { ...stored, name: name.trim(), email: email.trim(), phone: phone.replace(/\D/g, "") };

      if (stored.id === "admin-static" || stored.role === "admin") {
        window.localStorage.setItem("lms_user", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("lms_user_updated"));
        toast({ title: "Profile updated", description: "Admin profile saved locally." });
      } else {
        const res = await api.updateProfile({
          name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/\D/g, "")
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
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="10 digits"
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
