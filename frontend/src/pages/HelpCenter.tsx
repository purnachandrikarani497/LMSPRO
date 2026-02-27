import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Helmet } from "react-helmet-async";

const HelpCenter = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Help Center – LearnHub LMS</title>
      <meta
        name="description"
        content="Find answers to common questions about using the LearnHub learning platform."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Help Center</h1>
        <p className="mt-3 text-muted-foreground">
          Browse frequently asked questions about accounts, courses, and certificates.
        </p>
        <div className="mt-8">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="account">
              <AccordionTrigger>How do I create a LearnHub account?</AccordionTrigger>
              <AccordionContent>
                Select the sign up option from the navigation bar, enter your details, and confirm your email to
                start learning.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="courses">
              <AccordionTrigger>Where can I see all available courses?</AccordionTrigger>
              <AccordionContent>
                Use the Browse Courses link or open the Courses page to explore the full catalog by category and
                level.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="certificates">
              <AccordionTrigger>How do certificates work?</AccordionTrigger>
              <AccordionContent>
                After completing all lessons and assessments in a course, you can generate a certificate from your
                dashboard.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </main>
  </div>
);

export default HelpCenter;
