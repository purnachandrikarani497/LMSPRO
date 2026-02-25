import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { BookOpen, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

const passwordMinLength = 6;
const passwordMaxLength = 12;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid or expired.",
        variant: "destructive"
      });
      navigate("/auth?tab=signin");
    }
  }, [token, email, navigate, toast]);

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.resetPassword({
      email: email || "",
      token: token || "",
      newPassword: newPassword
    }),
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/auth?tab=signin");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    }
  });

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl border border-border bg-card p-8 shadow-card-hover">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">Password Reset Successful</h1>
          <p className="text-muted-foreground">Your password has been updated. Redirecting you to sign in...</p>
          <Button asChild className="w-full bg-gradient-gold text-primary font-semibold">
            <Link to="/auth?tab=signin">Go to Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero p-4">
      <Helmet>
        <title>Reset Password – LearnHub LMS</title>
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
          <h1 className="mb-2 text-2xl font-bold text-primary-foreground text-center">Set New Password</h1>
          <p className="mb-6 text-sm text-muted-foreground text-center">
            Please enter your new password below to secure your account.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="New Password"
                  type={showPassword ? "text" : "password"}
                  className="pl-10 pr-10"
                  value={newPassword}
                  maxLength={passwordMaxLength}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Confirm Password"
                  type={showPassword ? "text" : "password"}
                  className="pl-10"
                  value={confirmPassword}
                  maxLength={passwordMaxLength}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs font-medium text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90 mt-4"
              onClick={() => resetPasswordMutation.mutate()}
              disabled={
                resetPasswordMutation.isPending || 
                !newPassword || 
                newPassword !== confirmPassword || 
                newPassword.length < passwordMinLength
              }
            >
              {resetPasswordMutation.isPending ? "Updating..." : "Reset Password"}
            </Button>

            <div className="text-center mt-4">
              <Link to="/auth?tab=signin" className="text-sm text-secondary hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
