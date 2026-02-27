import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

const Careers = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Careers – LearnHub LMS</title>
      <meta
        name="description"
        content="Explore career opportunities with LearnHub and help shape the future of online learning."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Careers</h1>
        <p className="mt-3 text-muted-foreground">
          We are always interested in working with people who care deeply about education and technology.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">Product & Engineering</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Help build the tools that power modern learning experiences, from content creation to analytics.
          </CardContent>
        </Card>
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">Content & Instruction</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Work with instructors and partners to design engaging, project‑based courses for learners worldwide.
          </CardContent>
        </Card>
      </div>
      <div className="mt-12 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        <p>
          This is a demo application, so there are no open positions to apply for, but in a real deployment this
          page would highlight roles, locations, and your hiring process.
        </p>
      </div>
    </main>
  </div>
);

export default Careers;
