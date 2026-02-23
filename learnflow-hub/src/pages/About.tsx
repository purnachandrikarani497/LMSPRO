import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet-async";

const About = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>About Us – LearnHub LMS</title>
      <meta
        name="description"
        content="Learn more about the mission behind LearnHub and how we empower modern learners."
      />
    </Helmet>
    <Navbar />
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">About LearnHub</h1>
        <p className="mt-3 text-muted-foreground">
          LearnHub is built for creators, instructors, and organizations that want to deliver engaging,
          outcomes‑driven learning experiences.
        </p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Our platform combines expert‑led courses, rich assessments, and certificates so that learners can
            build real skills while tracking their progress with confidence.
          </p>
          <p>
            From individual students to global teams, we focus on clarity, usability, and performance so that
            the learning experience feels modern and intuitive on every device.
          </p>
          <p>
            This demo showcases what a production‑ready LMS can look like, including course catalogs, quizzes,
            dashboards, and certificates.
          </p>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default About;
