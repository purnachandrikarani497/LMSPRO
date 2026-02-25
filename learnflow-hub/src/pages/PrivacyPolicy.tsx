import { Helmet } from "react-helmet-async";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Privacy Policy – LearnHub LMS</title>
      <meta
        name="description"
        content="Understand how LearnHub handles data, privacy, and security for learners and organizations."
      />
    </Helmet>
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Privacy Policy</h1>
        <p>
          This demo application is designed for educational purposes. It does not process real payments and should
          not be used in production without a full review of your own privacy, security, and compliance needs.
        </p>
        <p>
          In a real deployment, this page would describe what data is collected, how it is used, and how learners
          can manage or request deletion of their information.
        </p>
        <p>
          Always consult with legal and security professionals when adapting this project for live environments to
          ensure that your policies align with regional regulations and best practices.
        </p>
      </div>
    </main>
  </div>
);

export default PrivacyPolicy;
