import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

const nameMaxLength = 40;
const emailMaxLength = 50;
const passwordMinLength = 6;
const passwordMaxLength = 12;

type SigninErrors = {
  email?: string;
  password?: string;
};

type SignupErrors = {
  name?: string;
  email?: string;
  password?: string;
};

const validateName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Full name is required";
  }
  if (trimmed.length < 2) {
    return "Full name must be at least 2 characters";
  }
  if (trimmed.length > nameMaxLength) {
    return `Full name must be at most ${nameMaxLength} characters`;
  }
  return null;
};

const validateEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required";
  }
  if (trimmed.length < 2) {
    return "Email must be at least 2 characters";
  }
  if (trimmed.length > emailMaxLength) {
    return `Email must be at most ${emailMaxLength} characters`;
  }
  if (!trimmed.includes("@")) {
    return "Email must include @";
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return "Enter a valid email address";
  }
  return null;
};

const validatePassword = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Password is required";
  }
  if (trimmed.length < passwordMinLength) {
    return `Password must be at least ${passwordMinLength} characters`;
  }
  if (trimmed.length > passwordMaxLength) {
    return `Password must be at most ${passwordMaxLength} characters`;
  }
  return null;
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signinErrors, setSigninErrors] = useState<SigninErrors>({});
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});

  const handleAuthSuccess = (data: { token: string; user: { role: string } }) => {
    window.localStorage.setItem("lms_token", data.token);
    window.localStorage.setItem("lms_user", JSON.stringify(data.user));
    toast({ title: "Welcome back", description: "You are now signed in" });
    navigate("/");
  };

  const loginMutation = useMutation({
    mutationFn: () => api.login({ email: signinEmail.trim(), password: signinPassword }),
    onSuccess: (data) => handleAuthSuccess(data),
    onError: () => {
      toast({ title: "Sign in failed", description: "Check your credentials", variant: "destructive" });
    }
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.register({
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        role: "student"
      }),
    onSuccess: (data) => {
      toast({ title: "Account created", description: "You are now signed in" });
      handleAuthSuccess(data);
    },
    onError: () => {
      toast({ title: "Sign up failed", description: "Please try again with different details", variant: "destructive" });
    }
  });

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
      return;
    }
    loginMutation.mutate();
  };

  const handleSignup = () => {
    const nameError = validateName(signupName);
    const emailError = validateEmail(signupEmail);
    const passwordError = validatePassword(signupPassword);
    const nextErrors: SignupErrors = {};
    if (nameError) {
      nextErrors.name = nameError;
    }
    if (emailError) {
      nextErrors.email = emailError;
    }
    if (passwordError) {
      nextErrors.password = passwordError;
    }
    setSignupErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
      <Helmet>
        <title>Sign In / Sign Up – LearnHub LMS</title>
      </Helmet>
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
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    className="pl-10"
                    value={signinEmail}
                    maxLength={emailMaxLength}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length > emailMaxLength) {
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
                  {signinErrors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signinErrors.email}</p>
                  )}
                </div>
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
                  {signinErrors.password && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signinErrors.password}</p>
                  )}
                </div>
                <Button
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  onClick={handleSignin}
                  disabled={loginMutation.isPending}
                >
                  Sign In
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  <Link to="#" className="text-secondary hover:underline">Forgot password?</Link>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Full Name"
                    className="pl-10"
                    value={signupName}
                    maxLength={nameMaxLength}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length > nameMaxLength) {
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
                  {signupErrors.name && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.name}</p>
                  )}
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    className="pl-10"
                    value={signupEmail}
                    maxLength={emailMaxLength}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length > emailMaxLength) {
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
                  {signupErrors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.email}</p>
                  )}
                </div>
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
                  {signupErrors.password && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.password}</p>
                  )}
                </div>
                <Button
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  onClick={handleSignup}
                  disabled={registerMutation.isPending}
                >
                  Create Account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By signing up, you agree to our Terms of Service
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
