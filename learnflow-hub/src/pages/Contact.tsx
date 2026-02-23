import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Helmet } from "react-helmet-async";

const Contact = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Contact – LearnHub LMS</title>
      <meta
        name="description"
        content="Contact the LearnHub team with questions about the platform, pricing, or partnerships."
      />
    </Helmet>
    <Navbar />
    <main className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Contact</h1>
        <p className="mt-3 text-muted-foreground">
          Send us a message and we will get back to you as soon as possible.
        </p>
        <form className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <Input placeholder="Your name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Message</label>
            <Textarea placeholder="How can we help?" rows={5} />
          </div>
          <Button type="button" className="bg-gradient-gold text-primary shadow-gold hover:opacity-90">
            Submit
          </Button>
        </form>
      </div>
    </main>
    <Footer />
  </div>
);

export default Contact;
