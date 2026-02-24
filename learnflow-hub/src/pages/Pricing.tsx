import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Get started with a limited selection of free courses.",
    features: ["Access to selected free courses", "Basic progress tracking", "Community support"]
  },
  {
    name: "Pro",
    price: "$19/mo",
    description: "Unlock the full library for individual learners.",
    features: ["Unlimited course access", "Certificates of completion", "Priority support"]
  },
  {
    name: "Teams",
    price: "Contact us",
    description: "Flexible plans for teams and businesses.",
    features: ["Team analytics dashboard", "Centralized billing", "Dedicated success manager"]
  }
];

const Pricing = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Pricing – LearnHub LMS</title>
      <meta
        name="description"
        content="Compare LearnHub pricing plans and choose the right option for your learning journey."
      />
    </Helmet>
    <Navbar />
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Simple plans designed to grow with your skills, from free to business-ready.
        </p>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className="flex flex-col justify-between border-border bg-card shadow-card">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-card-foreground">{plan.name}</CardTitle>
              <p className="mt-2 text-2xl font-bold text-secondary">{plan.price}</p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link to="/auth?tab=signup">
                <Button className="w-full bg-gradient-gold text-primary shadow-gold hover:opacity-90">
                  Get started
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
    <Footer />
  </div>
);

export default Pricing;
