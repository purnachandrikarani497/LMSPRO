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

