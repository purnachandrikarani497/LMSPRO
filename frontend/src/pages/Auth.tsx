import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, User, Eye, EyeOff, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

const nameMaxLength = 50;
const emailMaxLength = 50;
const phoneMaxLength = 10;
const passwordMinLength = 6;
const passwordMaxLength = 12;

type SigninErrors = {
  email?: string;
  password?: string;
};

type SignupErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const validateName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your full name";
  }
  if (!/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
    return "Name can only contain letters, numbers, and spaces";
  }
  if (trimmed.length > nameMaxLength) {
    return `Use at most ${nameMaxLength} characters`;
  }
  return null;
};

const validateEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your email";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) return "Enter a valid email address";
  if (trimmed.length > emailMaxLength) {
    return `Use at most ${emailMaxLength} characters`;
  }
  return null;
};

const validatePhone = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your phone number";
  }
  if (!/^[6-9]\d{9}$/.test(trimmed)) return "Enter a valid 10-digit phone starting with 6-9";
  return null;
};

const validatePassword = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your password";
  }
  if (trimmed.length < passwordMinLength) {
    return `Use at least ${passwordMinLength} characters`;
  }
  if (trimmed.length > passwordMaxLength) {
    return `Use at most ${passwordMaxLength} characters`;
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return "Password must contain at least one letter";
  }
  if (!/[0-9]/.test(trimmed)) {
    return "Password must contain at least one number";
  }
  return null;
};

const AuthLegalLine = ({ lead }: { lead: string }) => (
  <p className="text-center text-xs leading-relaxed text-muted-foreground">
    {lead}{" "}
    <Link to="/terms-of-service" className="text-secondary underline underline-offset-2 hover:text-foreground">
      Terms
    </Link>
    {" & "}
    <Link to="/privacy-policy" className="text-secondary underline underline-offset-2 hover:text-foreground">
      Privacy
    </Link>
  </p>
);

const Auth = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signinErrors, setSigninErrors] = useState<SigninErrors>({});
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  
  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState("");
  const [isLinkSent, setIsLinkSent] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAuthSuccess = (data: { token: string; user: { role: string } }) => {
    window.localStorage.setItem("lms_token", data.token);
    window.localStorage.setItem("lms_user", JSON.stringify(data.user));
    toast({ title: "Welcome back", description: "You are now signed in" });
    if (data.user?.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/");
    }
  };

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleMutateRef = useRef<(credential: string) => void>(() => {});

  const loginMutation = useMutation({
    mutationFn: () => api.login({ email: signinEmail.trim(), password: signinPassword }),
    onSuccess: (data) => handleAuthSuccess(data),
    onError: (err: Error) => {
      let msg = "Please check your credentials";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
          msg = parsed.message;
        }
      } catch {
        msg = err?.message || msg;
      }
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    }
  });

  const googleMutation = useMutation({
    mutationFn: (credential: string) => api.googleAuth(credential),
    onSuccess: (data) => handleAuthSuccess(data),
    onError: (err: Error) => {
      let msg = "Could not complete Google sign-in";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
          msg = parsed.message;
        }
      } catch {
        msg = err?.message || msg;
      }
      toast({ title: "Google sign-in failed", description: msg, variant: "destructive" });
    }
  });

  googleMutateRef.current = (credential: string) => {
    googleMutation.mutate(credential);
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId) return;

    const mountGoogleButton = () => {
      const el = googleBtnRef.current;
      const g = window.google?.accounts?.id;
      if (!el || !g) return;

      if (!window.__lmsGoogleGsiInitialized) {
        g.initialize({
          client_id: googleClientId,
          callback: (response: { credential: string }) => {
            googleMutateRef.current(response.credential);
          }
        });
        window.__lmsGoogleGsiInitialized = true;
      }

      el.innerHTML = "";
      const width = Math.max(280, Math.min(el.offsetWidth || 400, 448));
      g.renderButton(el, {
        theme: "outline",
        size: "large",
        width,
        text: "continue_with",
        locale: "en"
      });
    };

    const onScriptLoad = () => {
      requestAnimationFrame(() => mountGoogleButton());
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        onScriptLoad();
      } else {
        existing.addEventListener("load", onScriptLoad);
      }
      return () => existing.removeEventListener("load", onScriptLoad);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = onScriptLoad;
    document.body.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, [googleClientId]);

  const registerMutation = useMutation({
    mutationFn: () =>
      api.register({
        name: signupName.trim(),
        email: signupEmail.trim(),
        phone: signupPhone.trim(),
        password: signupPassword,
        role: "student"
      }),
    onSuccess: (data) => {
      toast({ title: "Account created", description: "You are now signed in" });
      handleAuthSuccess(data);
    },
    onError: (err: Error) => {
      const msg = err?.message || "Try again with different details";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: () => api.forgotPassword(forgotEmail.trim()),
    onSuccess: (data) => {
      const title = data.emailDeliveryFailed ? "Email not configured" : "Check your email";
      toast({
        title,
        description: data.message,
        variant: data.emailDeliveryFailed ? "destructive" : "default"
      });
      setIsLinkSent(true);
      if (import.meta.env.DEV && data.devLink) {
        console.log("Password reset link (dev):", data.devLink);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not send reset email", description: error.message, variant: "destructive" });
    }
  });

  const handleForgotSubmit = () => {
    const err = validateEmail(forgotEmail);
    if (err) {
      toast({ title: "Invalid email", description: err, variant: "destructive" });
      return;
    }
    forgotPasswordMutation.mutate();
  };

  const handleSignin = () => {
    const emailError = validateEmail(signinEmail);
    const passwordError = validatePassword(signinPassword);
    const nextErrors: SigninErrors = {};
    if (emailError) {
      nextErrors.email = emailError;
    }
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    setSigninErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const msgs = [
        emailError ? `Email: ${emailError}` : null,
        passwordError ? `Password: ${passwordError}` : null
      ].filter(Boolean).join(" • ");
      toast({ title: "Fix the highlighted fields", description: msgs, variant: "destructive" });
      return;
    }
    loginMutation.mutate();
  };

  const handleSignup = () => {
    const nameError = validateName(signupName);
    const emailError = validateEmail(signupEmail);
    const phoneError = validatePhone(signupPhone);
    const passwordError = validatePassword(signupPassword);
    const nextErrors: SignupErrors = {};
    if (nameError) nextErrors.name = nameError;
    if (emailError) nextErrors.email = emailError;
    if (phoneError) nextErrors.phone = phoneError;
    if (passwordError) nextErrors.password = passwordError;
    setSignupErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const msgs = [
        nameError ? `Name: ${nameError}` : null,
        emailError ? `Email: ${emailError}` : null,
        phoneError ? `Phone: ${phoneError}` : null,
        passwordError ? `Password: ${passwordError}` : null
      ].filter(Boolean).join(" • ");
      toast({ title: "Fix the highlighted fields", description: msgs, variant: "destructive" });
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-hero">
      <Helmet>
        <title>Sign In / Sign Up – LearnHub LMS</title>
      </Helmet>
      <div className="flex w-full flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-heading text-2xl font-bold text-primary-foreground">LearnHub</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-card-hover">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="signin" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); handleSignin(); }}
              >
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Email"
                      type="text"
                      maxLength={emailMaxLength}
                      className="pl-10"
                      value={signinEmail}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > emailMaxLength) {
                          toast({ title: "Max limit reached", description: `Email cannot exceed ${emailMaxLength} characters`, variant: "destructive" });
                          return;
                        }
                        setSigninEmail(value);
                        setSigninErrors((prev) => {
                          const error = validateEmail(value);
                          const next = { ...prev };
                          if (error) {
                            next.email = error;
                          } else {
                            delete next.email;
                          }
                          return next;
                        });
                      }}
                    />
                  </div>
                  {signinErrors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signinErrors.email}</p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Password"
                      type={showSigninPassword ? "text" : "password"}
                      className="pl-10 pr-10"
                      value={signinPassword}
                      maxLength={passwordMaxLength}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > passwordMaxLength) {
                          return;
                        }
                        setSigninPassword(value);
                        setSigninErrors((prev) => {
                          const error = validatePassword(value);
                          const next = { ...prev };
                          if (error) {
                            next.password = error;
                          } else {
                            delete next.password;
                          }
                          return next;
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSigninPassword((prev) => !prev)}
                    >
                      {showSigninPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {signinErrors.password && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signinErrors.password}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  disabled={loginMutation.isPending}
                >
                  Sign In
                </Button>
                <div className="text-center">
                  <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      setIsLinkSent(false);
                      setForgotEmail("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <button className="text-xs text-secondary hover:underline">Forgot password?</button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{isLinkSent ? "Check your email" : "Forgot Password"}</DialogTitle>
                        <DialogDescription>
                          {!isLinkSent
                            ? "Enter your email. We will send a link to reset your password (expires in one hour)."
                            : "If an account exists for that address, we sent a reset link. Use the link in the email to choose a new password — the link opens a secure reset page."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {!isLinkSent ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="Email Address"
                              type="text"
                              value={forgotEmail}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !forgotPasswordMutation.isPending) {
                                  e.preventDefault();
                                  handleForgotSubmit();
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value.length > emailMaxLength) {
                                   toast({ title: "Max limit reached", description: `Email cannot exceed ${emailMaxLength} characters`, variant: "destructive" });
                                   return;
                                 }
                                 setForgotEmail(value);
                              }}
                            />
                            <Button
                              type="button"
                              className="w-full bg-gradient-gold text-primary font-semibold"
                              disabled={forgotPasswordMutation.isPending || !forgotEmail}
                              onClick={handleForgotSubmit}
                            >
                              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <div className="flex justify-center">
                              <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Check your inbox and spam folder. Reset must be completed using the link in the email.
                            </p>
                            <Button 
                              variant="ghost" 
                              className="w-full text-xs" 
                              onClick={() => setIsDialogOpen(false)}
                            >
                              Close
                            </Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); handleSignup(); }}
              >
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Full Name"
                      className="pl-10"
                      value={signupName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > nameMaxLength) {
                          toast({ title: "Max limit reached", description: `Name cannot exceed ${nameMaxLength} characters`, variant: "destructive" });
                          return;
                        }
                        if (value && !/^[a-zA-Z0-9\s]+$/.test(value)) {
                          toast({ title: "Invalid character", description: "Name can only contain letters, numbers, and spaces", variant: "destructive" });
                          return;
                        }
                        setSignupName(value);
                        setSignupErrors((prev) => {
                          const error = validateName(value);
                          const next = { ...prev };
                          if (error) {
                            next.name = error;
                          } else {
                            delete next.name;
                          }
                          return next;
                        });
                      }}
                    />
                  </div>
                  {signupErrors.name && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.name}</p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Email"
                      type="text"
                      maxLength={emailMaxLength}
                      className="pl-10"
                      value={signupEmail}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > emailMaxLength) {
                          toast({ title: "Max limit reached", description: `Email cannot exceed ${emailMaxLength} characters`, variant: "destructive" });
                          return;
                        }
                        setSignupEmail(value);
                        setSignupErrors((prev) => {
                          const error = validateEmail(value);
                          const next = { ...prev };
                          if (error) {
                            next.email = error;
                          } else {
                            delete next.email;
                          }
                          return next;
                        });
                      }}
                    />
                  </div>
                  {signupErrors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.email}</p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Phone number"
                      type="tel"
                      className="pl-10"
                      value={signupPhone}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > phoneMaxLength) value = value.slice(0, phoneMaxLength);
                        // Enforce first digit 6-9
                        if (value.length >= 1 && !/^[6-9]$/.test(value[0])) {
                          toast({ title: "Invalid phone", description: "First digit must be 6-9", variant: "destructive" });
                          return;
                        }
                        setSignupPhone(value);
                        setSignupErrors((prev) => {
                          const error = validatePhone(value);
                          const next = { ...prev };
                          if (error) next.phone = error;
                          else delete next.phone;
                          return next;
                        });
                      }}
                    />
                  </div>
                  {signupErrors.phone && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.phone}</p>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Password"
                      type={showSignupPassword ? "text" : "password"}
                      className="pl-10 pr-10"
                      value={signupPassword}
                      maxLength={passwordMaxLength}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length > passwordMaxLength) {
                          return;
                        }
                        setSignupPassword(value);
                        setSignupErrors((prev) => {
                          const error = validatePassword(value);
                          const next = { ...prev };
                          if (error) {
                            next.password = error;
                          } else {
                            delete next.password;
                          }
                          return next;
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSignupPassword((prev) => !prev)}
                    >
                      {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {signupErrors.password && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.password}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  disabled={registerMutation.isPending}
                >
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {googleClientId ? (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with Google</span>
                </div>
              </div>
              <div
                ref={googleBtnRef}
                className="flex min-h-[44px] w-full justify-center [&_iframe]:max-w-full"
              />
              {googleMutation.isPending ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">Signing in with Google…</p>
              ) : null}
              <div className="pt-3">
                <AuthLegalLine lead="By continuing, you agree to our" />
              </div>
            </>
          ) : (
            <div className="pt-6">
              <AuthLegalLine lead="By continuing, you agree to our" />
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Auth;
