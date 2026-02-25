import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

const posts = [
  {
    title: "Designing engaging online courses",
    date: "2025",
    summary: "Practical guidelines for structuring lessons, projects, and assessments that keep learners active."
  },
  {
    title: "Why certificates still matter",
    date: "2025",
    summary: "How verifiable certificates help learners showcase their skills to employers and clients."
  },
  {
    title: "Building a modern LMS with React",
    date: "2025",
    summary: "An overview of the architecture behind LearnHub and similar modern learning platforms."
  }
];

const Blog = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Blog – LearnHub LMS</title>
      <meta
        name="description"
        content="Read product updates, best practices, and ideas for creating better online learning experiences."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Blog</h1>
        <p className="mt-3 text-muted-foreground">
          Insights and stories about online education, course creation, and the future of learning.
        </p>
        <div className="mt-8 space-y-4">
          {posts.map((post) => (
            <Card key={post.title} className="border-border bg-card shadow-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-card-foreground">{post.title}</CardTitle>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{post.date}</p>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{post.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  </div>
);

export default Blog;
