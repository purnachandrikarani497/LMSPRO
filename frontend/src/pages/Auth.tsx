import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
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
    return "Enter your full name";
  }
  if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
    return "Name can only contain characters";
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
  if (!trimmed.includes("@")) {
    return "Email must contain @";
  }
  if (trimmed.length > emailMaxLength) {
    return `Use at most ${emailMaxLength} characters`;
  }
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
  
  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState("");
  const [isLinkSent, setIsLinkSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
      toast({ title: "Sign in failed", description: "Please check your credentials", variant: "destructive" });
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
      toast({ title: "Sign up failed", description: "Try again with different details", variant: "destructive" });
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: () => api.forgotPassword(forgotEmail.trim()),
    onSuccess: (data) => {
      toast({ title: "Link sent", description: data.message });
      setIsLinkSent(true);
      if (data.token) {
        setResetToken(data.token);
      }
      // In development, log the link
      if (data.devLink) {
        console.log("Password Reset Link:", data.devLink);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { email: string; token: string; newPassword: string }) => api.resetPassword(data),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      setIsDialogOpen(false);
      setIsLinkSent(false);
      setShowResetPassword(false);
      setForgotEmail("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      // Pre-fill login with the reset email
      setSigninEmail(forgotEmail);
    },
    onError: (error: Error) => {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
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
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Email"
                      type="text"
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signinEmail.length}/{emailMaxLength}
                  </p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signinPassword.length}/{passwordMaxLength}
                  </p>
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
                <div className="text-center">
                  <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      setIsLinkSent(false);
                      setShowResetPassword(false);
                      setForgotEmail("");
                      setResetToken("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <button className="text-xs text-secondary hover:underline">Forgot password?</button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {showResetPassword ? "Update Password" : "Forgot Password"}
                        </DialogTitle>
                        <DialogDescription>
                          {!isLinkSent 
                            ? "Enter your email to receive a password reset link." 
                            : showResetPassword 
                              ? "Enter your new password below." 
                              : "We've sent a link to your email. You can also update it right here."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {!isLinkSent ? (
                          <div className="space-y-2">
                            <Input
                              placeholder="Email Address"
                              type="text"
                              value={forgotEmail}
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
                              className="w-full bg-gradient-gold text-primary font-semibold" 
                              onClick={() => forgotPasswordMutation.mutate()}
                              disabled={forgotPasswordMutation.isPending || !forgotEmail}
                            >
                              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                            </Button>
                          </div>
                        ) : !showResetPassword ? (
                          <div className="text-center space-y-4">
                            <div className="flex justify-center">
                              <CheckCircle2 className="h-12 w-12 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              A reset link has been sent to your email.
                            </p>
                            <Button 
                              className="w-full bg-gradient-gold text-primary font-semibold" 
                              onClick={() => setShowResetPassword(true)}
                            >
                              Update Password Here
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="w-full text-xs" 
                              onClick={() => setIsDialogOpen(false)}
                            >
                              Close
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="space-y-2">
                              <Input
                                placeholder="New Password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Input
                                placeholder="Confirm Password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                              />
                              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs text-destructive">Passwords do not match</p>
                              )}
                            </div>
                            <Button 
                              className="w-full bg-gradient-gold text-primary font-semibold" 
                              onClick={() => resetPasswordMutation.mutate({
                                email: forgotEmail.trim(),
                                token: resetToken,
                                newPassword: newPassword
                              })}
                              disabled={
                                resetPasswordMutation.isPending || 
                                !newPassword || 
                                newPassword !== confirmPassword ||
                                newPassword.length < passwordMinLength
                              }
                            >
                              {resetPasswordMutation.isPending ? "Updating..." : "Update Password"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="w-full text-xs" 
                              onClick={() => setShowResetPassword(false)}
                            >
                              Back
                            </Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="space-y-4">
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
                        if (value && !/^[a-zA-Z\s]+$/.test(value)) {
                          toast({ title: "Invalid character", description: "Name can only contain characters", variant: "destructive" });
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signupName.length}/{nameMaxLength}
                  </p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signupEmail.length}/{emailMaxLength}
                  </p>
                  {signupErrors.email && (
                    <p className="mt-1 text-xs font-medium text-destructive">{signupErrors.email}</p>
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signupPassword.length}/{passwordMaxLength}
                  </p>
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
