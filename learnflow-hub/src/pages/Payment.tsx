import { useParams, Link, useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, ApiCourse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { courses as mockCourses } from "@/lib/mockData";

type PaymentCourse = {
  id: string;
  title: string;
  price: number;
};

const Payment = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    data: apiCourse,
    isLoading,
    isError
  } = useQuery<ApiCourse>({
    queryKey: ["course", courseId],
    queryFn: () => api.getCourse(courseId || ""),
    enabled: !!courseId,
    retry: false
  });

  const fallbackCourse = mockCourses.find((c) => c.id === courseId);

  const course: PaymentCourse | null =
    apiCourse
      ? {
          id: apiCourse._id || apiCourse.id || "",
          title: apiCourse.title,
          price: apiCourse.price ?? 0
        }
      : fallbackCourse
      ? {
          id: fallbackCourse.id,
          title: fallbackCourse.title,
          price: fallbackCourse.price
        }
      : null;

  const enrollMutation = useMutation({
    mutationFn: () => api.enroll(apiCourse?._id || apiCourse?.id || ""),
    onSuccess: () => {
      toast({
        title: "Payment successful",
        description: "You have been enrolled in this course"
      });
      navigate("/dashboard");
    },
    onError: (error) => {
      let message = "Please try again later";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
            message = parsed.message;
          }
        } catch {
          message = error.message || "Please try again later";
        }
      }
      if (message === "Already enrolled") {
        toast({
          title: "Already enrolled",
          description: "You are already enrolled in this course"
        });
        navigate("/dashboard");
        return;
      }
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive"
      });
    }
  });

  if (isLoading && !course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if ((isError && !course) || !course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Course not found</p>
          <Link to="/courses" className="mt-4 inline-block text-primary hover:underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Payment – {course.title}</title>
      </Helmet>
      <Navbar />
      <main className="container mx-auto px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h1 className="font-heading text-2xl font-bold text-foreground">Checkout</h1>
            <p className="text-sm text-muted-foreground">
              Complete your enrollment for <span className="font-semibold">{course.title}</span>.
            </p>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-secondary bg-secondary/10 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">UPI</p>
                        <p className="text-xs text-muted-foreground">
                          Pay instantly using your UPI app
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold uppercase text-secondary">Selected</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Course</span>
                  <span className="font-medium text-foreground">{course.title}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold text-foreground">${course.price ?? 0}</span>
                </div>
                <Button
                  className="mt-2 w-full bg-gradient-gold text-primary shadow-gold hover:opacity-90"
                  size="lg"
                  onClick={() => {
                    if (!apiCourse) {
                      toast({
                        title: "Demo course",
                        description: "Enrollment is only available for live backend courses."
                      });
                      return;
                    }
                    enrollMutation.mutate();
                  }}
                  disabled={enrollMutation.isPending}
                >
                  Pay with UPI
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => navigate(-1)}
                >
                  Back
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Payment;
