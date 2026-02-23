import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

const footerColumns = [
  {
    title: "Platform",
    links: [
      { label: "Browse Courses", to: "/courses" },
      { label: "Pricing", to: "/pricing" },
      { label: "For Business", to: "/for-business" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Careers", to: "/careers" },
      { label: "Blog", to: "/blog" }
    ]
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", to: "/help-center" },
      { label: "Contact", to: "/contact" },
      { label: "Privacy Policy", to: "/privacy-policy" }
    ]
  }
];

const Footer = () => (
  <footer className="border-t border-border bg-primary text-primary-foreground">
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-gold">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <span className="font-heading text-lg font-bold">LearnHub</span>
          </div>
          <p className="text-sm text-primary-foreground/60 leading-relaxed">
            Empowering learners worldwide with expert-led courses and cutting-edge content.
          </p>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-primary-foreground/40">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-primary-foreground/60 transition-colors hover:text-secondary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-primary-foreground/10 pt-6 text-center text-xs text-primary-foreground/40">
        © 2025 LearnHub. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
