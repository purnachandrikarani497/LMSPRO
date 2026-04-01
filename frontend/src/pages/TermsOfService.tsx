import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Terms of Service – LearnHub LMS</title>
      <meta
        name="description"
        content="Terms of Service for LearnHub — rules for using our learning platform."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Terms of Service</h1>
        <p className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">1. Agreement</h2>
          <p>
            By accessing or using LearnHub (“the Service”), you agree to these Terms of Service. If you do not agree,
            do not use the Service. We may update these terms from time to time; continued use after changes means you
            accept the revised terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">2. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity
            under your account. You must provide accurate information when registering and notify us of any unauthorized
            use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">3. Use of the platform</h2>
          <p>
            You agree to use LearnHub only for lawful purposes and in a way that does not infringe the rights of others
            or restrict their use of the Service. You must not attempt to gain unauthorized access to systems, data,
            or other users’ accounts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">4. Courses and content</h2>
          <p>
            Course materials are provided for your personal learning. Unless expressly permitted, you may not copy,
            redistribute, or resell content. Instructors and the platform retain rights to their respective materials.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">5. Disclaimer</h2>
          <p>
            The Service is provided “as is” without warranties of any kind. We do not guarantee uninterrupted access or
            that content will meet every expectation. For production use, obtain appropriate legal and technical
            review.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">6. Contact</h2>
          <p>
            For questions about these terms, contact us through the{" "}
            <Link to="/contact" className="text-secondary underline underline-offset-2 hover:text-foreground">
              Contact
            </Link>{" "}
            page. See also our{" "}
            <Link to="/privacy-policy" className="text-secondary underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  </div>
);

export default TermsOfService;
