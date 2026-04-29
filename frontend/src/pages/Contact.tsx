import { Mail, MapPin, Phone } from "lucide-react";
import { Helmet } from "react-helmet-async";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Contact – LearnHub LMS</title>
        <meta
          name="description"
          content="Reach the LearnHub team — demo contact details for support and general inquiries."
        />
      </Helmet>
      <main className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Contact us</h1>
          <p className="mt-3 text-muted-foreground">
            Demo contact information below. Replace with your real details when you go live.
          </p>

          <ul className="mt-10 space-y-8">
            <li className="flex gap-4 rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-gold">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Email
                </h2>
                <p className="mt-1 text-card-foreground">
                  <a href="mailto:hello@learnhub.demo" className="text-secondary hover:underline">
                    hello@learnhub.demo
                  </a>
                </p>
              </div>
            </li>
            <li className="flex gap-4 rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-gold">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Phone
                </h2>
                <p className="mt-1 text-card-foreground">
                  <a href="tel:+15551234567" className="text-secondary hover:underline">
                    +1 (555) 123-4567
                  </a>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Mon–Fri, 9:00 a.m.–5:00 p.m. EST (demo hours)</p>
              </div>
            </li>
            <li className="flex gap-4 rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-gold">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Office
                </h2>
                <p className="mt-1 text-card-foreground">
                  100 Learning Lane
                  <br />
                  Suite 200
                  <br />
                  San Francisco, CA 94102
                </p>
              </div>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Contact;
