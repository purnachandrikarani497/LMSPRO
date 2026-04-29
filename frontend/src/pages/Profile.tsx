import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StoredUser {
  name?: string;
  email?: string;
  phone?: string;
  role?: "admin" | "student";
}

const Profile = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "student" | undefined>();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
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
      setRole(parsed.role);
    } catch { /* ignore */ }
  }, []);

  const startEdit = () => {
    setEditName(name);
    setEditEmail(email);
    setEditPhone(phone);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  // ── Name handlers ──────────────────────────────────────────
  const handleNameChange = (val: string) => {
    if (val.length > 80) {
      toast({ title: "Max limit reached", description: "Full name cannot exceed 80 characters.", variant: "destructive" });
      return;
    }
    if (val && !/^[a-zA-Z\s]*$/.test(val)) {
      toast({ title: "Invalid character", description: "Name can only contain letters and spaces.", variant: "destructive" });
      return;
    }
    setEditName(val);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
    if (!/^[a-zA-Z\s]$/.test(e.key)) {
      e.preventDefault();
      toast({ title: "Invalid character", description: "Name can only contain letters and spaces.", variant: "destructive" });
      return;
    }
    if (editName.length >= 80) {
      e.preventDefault();
      toast({ title: "Max limit reached", description: "Full name cannot exceed 80 characters.", variant: "destructive" });
    }
  };

  // ── Email handlers ─────────────────────────────────────────
  const handleEmailChange = (val: string) => {
    if (val.length > 100) {
      toast({ title: "Max limit reached", description: "Email cannot exceed 100 characters.", variant: "destructive" });
      return;
    }
    setEditEmail(val);
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
    if (editEmail.length >= 100) {
      e.preventDefault();
      toast({ title: "Max limit reached", description: "Email cannot exceed 100 characters.", variant: "destructive" });
    }
  };

  // ── Phone handlers ─────────────────────────────────────────
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length > 10) {
      toast({ title: "Max limit reached", description: "Phone number cannot exceed 10 digits.", variant: "destructive" });
      return;
    }
    if (digits.length >= 1 && /^[0-5]/.test(digits)) {
      toast({ title: "Invalid phone number", description: "Mobile number must start with 6, 7, 8, or 9.", variant: "destructive" });
      return;
    }
    setEditPhone(digits);
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }
    if (editPhone.length >= 10) {
      e.preventDefault();
      toast({ title: "Max limit reached", description: "Phone number cannot exceed 10 digits.", variant: "destructive" });
      return;
    }
    if (editPhone.length === 0 && /^[0-5]$/.test(e.key)) {
      e.preventDefault();
      toast({ title: "Invalid phone number", description: "Mobile number must start with 6, 7, 8, or 9.", variant: "destructive" });
    }
  };

  // ── Save ───────────────────────────────────────────────────
  const saveEdit = async () => {
    const trimName = editName.trim();
    const trimEmail = editEmail.trim();
    const trimPhone = editPhone.trim();

    if (!trimName) {
      toast({ title: "Name required", description: "Full name cannot be empty.", variant: "destructive" }); return;
    }
    if (!/^[a-zA-Z\s]+$/.test(trimName)) {
      toast({ title: "Invalid name", description: "Name can only contain letters and spaces.", variant: "destructive" }); return;
    }
    if (!trimEmail) {
      toast({ title: "Email required", description: "Email cannot be empty.", variant: "destructive" }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" }); return;
    }
    if (trimPhone && !/^[6-9]\d{9}$/.test(trimPhone)) {
      toast({ title: "Invalid phone number", description: "Phone must be 10 digits and start with 6–9.", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      const res = await api.updateProfile({ name: trimName, email: trimEmail, phone: trimPhone || undefined });
      const u = res.user;
      setName(u.name || trimName);
      setEmail(u.email || trimEmail);
      setPhone(u.phone || trimPhone);

      const rawUser = window.localStorage.getItem("lms_user");
      if (rawUser) {
        try {
          const parsed = JSON.parse(rawUser) as StoredUser;
          parsed.name = u.name || trimName;
          parsed.email = u.email || trimEmail;
          parsed.phone = u.phone || trimPhone;
          window.localStorage.setItem("lms_user", JSON.stringify(parsed));
          window.dispatchEvent(new Event("lms_user_updated"));
        } catch { /* ignore */ }
      }

      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setEditing(false);
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isUser = role !== "admin";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profile – LearnHub LMS</title>
      </Helmet>
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">My Profile</h1>
            <p className="mt-2 text-muted-foreground">View and update your account details.</p>
          </div>
          {isUser && !editing && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        <div className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 shadow-card">
          {/* Full Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Full Name</label>
            {editing ? (
              <Input
                value={editName}
                maxLength={80}
                autoFocus
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleNameKeyDown}
                className="focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            ) : (
              <Input value={name} readOnly className="cursor-default bg-muted text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
            )}
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Email</label>
            {editing ? (
              <Input
                value={editEmail}
                maxLength={100}
                type="email"
                onChange={(e) => handleEmailChange(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                className="focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            ) : (
              <Input value={email} readOnly className="cursor-default bg-muted text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
            )}
          </div>

          {/* Phone – hidden for admin */}
          {isUser && <div>
            <label className="mb-1 block text-sm font-medium text-card-foreground">Phone Number</label>
            {editing ? (
              <Input
                value={editPhone}
                maxLength={10}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                onChange={(e) => handlePhoneChange(e.target.value)}
                onKeyDown={handlePhoneKeyDown}
                className="focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            ) : (
              <Input value={phone || "Not set"} readOnly className="cursor-default bg-muted text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />
            )}
          </div>}

          {/* Save / Cancel */}
          {editing && (
            <div className="flex gap-2 pt-2">
              <Button onClick={saveEdit} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={saving} className="gap-1.5">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
