import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, ApiCourse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { courses as mockCourses } from "@/lib/mockData";

type QuizCourse = ApiCourse & {
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
};

const QuizPage = () => {
  const { courseId } = useParams();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const {
    data: apiCourse,
    isLoading,
    isError
  } = useQuery<QuizCourse>({
    queryKey: ["course", courseId],
    queryFn: () => api.getCourse(courseId || ""),
    enabled: !!courseId,
    retry: false
  });

  const fallbackCourse = mockCourses.find((c) => c.id === courseId);

  const course: QuizCourse | null = apiCourse || (fallbackCourse as unknown as QuizCourse | undefined) || null;

  const submitMutation = useMutation({
    mutationFn: () => {
      const indices = (course?.quiz || []).map((_, index) =>
        answers[index] !== undefined ? answers[index] : -1
      );
      if (!apiCourse) {
        return Promise.reject(new Error("Quiz not available for this course"));
      }
      return api.submitQuiz(courseId || "", indices);
    },
    onSuccess: (data) => {
      toast({
        title: "Quiz submitted",
        description: `You scored ${data.score} out of ${(course?.quiz || []).length}`
      });
    },
    onError: () => {
      toast({
        title: "Quiz submission failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if ((isError && !course) || !course) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-lg text-muted-foreground">Quiz not found</p>
          <Link to="/courses" className="mt-4 inline-block text-primary hover:underline">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  const quiz = course.quiz || [];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{course.title} – Quiz</title>
        <meta
          name="description"
          content={`Quiz for course ${course.title}`}
        />
      </Helmet>
      <main className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Quiz: {course.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Answer all questions and submit to see your score.
            </p>
          </div>
          <Link to={`/course/${courseId}`} className="text-sm text-primary hover:underline">
            Back to course
          </Link>
        </div>

        {quiz.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No quiz has been added for this course yet.
          </p>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
        >
          {quiz.map((question, index) => (
            <Card key={question.question}>
              <CardHeader>
                <CardTitle className="text-base">
                  Q{index + 1}. {question.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {question.options?.map((option, optionIndex) => {
                    const selected = answers[index] === optionIndex;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [index]: optionIndex
                          }))
                        }
                        className={`flex w-full items-center rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "border-secondary bg-secondary/10 text-foreground"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

        {quiz.length > 0 && (
          <div className="mt-8 flex justify-end">
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="px-8 bg-gradient-gold text-primary shadow-gold hover:opacity-90"
            >
              Submit Quiz
            </Button>
          </div>
        )}
        </form>
      </main>
    </div>
  );
};

export default QuizPage;
