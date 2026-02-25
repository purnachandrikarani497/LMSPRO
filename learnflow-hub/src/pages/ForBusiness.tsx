import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

const ForBusiness = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>For Business – LearnHub LMS</title>
      <meta
        name="description"
        content="Empower your teams with LearnHub for Business: scalable training, analytics, and management tools."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">LearnHub for Business</h1>
        <p className="mt-3 text-muted-foreground">
          Build a culture of continuous learning with a modern LMS for teams of any size.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">Upskill your workforce</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Give employees access to curated learning paths across technical, leadership, and soft skills.
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">Track impact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Monitor adoption, progress, and completion rates with rich analytics and reporting.
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">Integrate easily</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Connect LearnHub with your existing tools to streamline onboarding and compliance training.
          </CardContent>
        </Card>
      </div>
      <div className="mt-12 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        <p>
          Whether you are training a small team or an entire organization, LearnHub helps deliver consistent,
          measurable learning experiences tailored to your business goals.
        </p>
      </div>
    </main>
  </div>
);

export default ForBusiness;
