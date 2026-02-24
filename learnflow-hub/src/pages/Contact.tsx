import { useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Helmet } from "react-helmet-async";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleNameChange = (value: string) => {
    let next = value.replace(/[^A-Za-z\s]/g, "");
    if (next.length > 30) {
      toast({
        title: "Name too long",
        description: "Name must be at most 30 characters.",
        variant: "destructive"
      });
      next = next.slice(0, 30);
    }
    setName(next);
  };

  const handleMessageChange = (value: string) => {
    let next = value.replace(/[^A-Za-z\s]/g, "");
    if (next.length > 150) {
      toast({
        title: "Message too long",
        description: "Message must be at most 150 characters.",
        variant: "destructive"
      });
      next = next.slice(0, 150);
    }
    setMessage(next);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      toast({
        title: "Missing information",
        description: "All fields are required and cannot be empty or spaces only.",
        variant: "destructive"
      });
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(trimmedName)) {
      toast({
        title: "Invalid name",
        description: "Name can contain only letters and spaces.",
        variant: "destructive"
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address with @ symbol.",
        variant: "destructive"
      });
      return;
    }

    if (!/^[A-Za-z\s]+$/.test(trimmedMessage)) {
      toast({
        title: "Invalid message",
        description: "Message can contain only letters and spaces.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Message sent",
      description: "Thank you for contacting us. We will get back to you soon."
    });

    setName("");
    setEmail("");
    setMessage("");
  };

  return (
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
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
              <Input
                placeholder="Your name"
                value={name}
                maxLength={30}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Message</label>
              <Textarea
                placeholder="How can we help?"
                rows={5}
                value={message}
                maxLength={150}
                onChange={(e) => handleMessageChange(e.target.value)}
              />
            </div>
            <Button type="submit" className="bg-gradient-gold text-primary shadow-gold hover:opacity-90">
              Submit
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
