export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  price: number;
  rating: number;
  students: number;
  duration: string;
  lessons: number;
  lessonItems?: {
    _id?: string;
    title: string;
    videoUrl?: string;
    content?: string;
    duration?: string;
    resources?: string[];
  }[];
  level: "Beginner" | "Intermediate" | "Advanced";
  image: string;
  featured?: boolean;
}

export const categories = [
  { name: "Development", icon: "💻", count: 42 },
  { name: "Design", icon: "🎨", count: 28 },
  { name: "Business", icon: "📊", count: 35 },
  { name: "Marketing", icon: "📣", count: 19 },
  { name: "Data Science", icon: "🔬", count: 23 },
  { name: "Photography", icon: "📷", count: 15 },
];

export const courses: Course[] = [
  {
    id: "1",
    title: "Complete Web Development Bootcamp 2025",
    description: "Learn HTML, CSS, JavaScript, React, Node.js and more. Build real-world projects and launch your career as a full-stack developer.",
    instructor: "Sarah Johnson",
    category: "Development",
    price: 89.99,
    rating: 4.9,
    students: 15420,
    duration: "62 hours",
    lessons: 385,
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop",
    featured: true,
  },
  {
    id: "2",
    title: "UI/UX Design Masterclass",
    description: "Master Figma, design thinking, and create stunning user experiences. From wireframes to polished prototypes.",
    instructor: "Michael Chen",
    category: "Design",
    price: 74.99,
    rating: 4.8,
    students: 8930,
    duration: "40 hours",
    lessons: 210,
    level: "Intermediate",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop",
    featured: true,
  },
  {
    id: "3",
    title: "Digital Marketing Strategy",
    description: "SEO, social media marketing, email campaigns, and analytics. Everything you need to grow any business online.",
    instructor: "Emily Davis",
    category: "Marketing",
    price: 59.99,
    rating: 4.7,
    students: 12100,
    duration: "35 hours",
    lessons: 180,
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    featured: true,
  },
  {
    id: "4",
    title: "Python for Data Science & Machine Learning",
    description: "From Python basics to advanced ML algorithms. Pandas, NumPy, Scikit-learn, TensorFlow and real datasets.",
    instructor: "Dr. James Wilson",
    category: "Data Science",
    price: 94.99,
    rating: 4.9,
    students: 21000,
    duration: "72 hours",
    lessons: 420,
    level: "Intermediate",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop",
  },
  {
    id: "5",
    title: "Business Analytics with Excel & Power BI",
    description: "Transform raw data into actionable insights. Advanced Excel, Power BI dashboards, and data storytelling.",
    instructor: "Lisa Park",
    category: "Business",
    price: 49.99,
    rating: 4.6,
    students: 6540,
    duration: "28 hours",
    lessons: 150,
    level: "Beginner",
    image: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=600&h=400&fit=crop",
  },
  {
    id: "6",
    title: "Advanced React & TypeScript Patterns",
    description: "Level up your React skills with advanced patterns, TypeScript, testing, and performance optimization.",
    instructor: "Alex Rivera",
    category: "Development",
    price: 79.99,
    rating: 4.8,
    students: 4320,
    duration: "45 hours",
    lessons: 240,
    level: "Advanced",
    image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=400&fit=crop",
  },
];

export const enrolledCourses = [
  { ...courses[0], progress: 65 },
  { ...courses[3], progress: 30 },
  { ...courses[5], progress: 10 },
];

export const stats = {
  totalStudents: 52000,
  totalCourses: 162,
  totalInstructors: 48,
  avgRating: 4.8,
};
