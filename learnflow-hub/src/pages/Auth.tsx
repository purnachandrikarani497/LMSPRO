import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { BookOpen, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

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

  const handleAuthSuccess = (data: { token: string; user: { role: string } }) => {
    window.localStorage.setItem("lms_token", data.token);
    window.localStorage.setItem("lms_user", JSON.stringify(data.user));
    toast({ title: "Welcome back", description: "You are now signed in" });
    if (data.user.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  const loginMutation = useMutation({
    mutationFn: () => api.login({ email: signinEmail, password: signinPassword }),
    onSuccess: (data) => handleAuthSuccess(data),
    onError: () => {
      toast({ title: "Sign in failed", description: "Check your credentials", variant: "destructive" });
    }
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.register({
        name: signupName,
        email: signupEmail,
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
                    onChange={(e) => setSigninEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Password"
                    type="password"
                    className="pl-10"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  onClick={() => loginMutation.mutate()}
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
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    className="pl-10"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Password"
                    type="password"
                    className="pl-10"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-gradient-gold font-semibold text-primary shadow-gold hover:opacity-90"
                  onClick={() => registerMutation.mutate()}
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
