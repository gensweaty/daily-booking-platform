import { Calendar, ChartBar, ListTodo } from "lucide-react";
import { FeatureCard } from "./FeatureCard";

const calendarViews = [
  {
    src: "/lovable-uploads/5fa665bc-9bd3-4ebd-9294-77abf03f5a1f.png",
    alt: "Tasks View",
    title: "Tasks View"
  },
  {
    src: "/lovable-uploads/bca9780e-763a-4a39-9044-9626c2f0b034.png",
    alt: "Statistics View",
    title: "Statistics View"
  },
  {
    src: "/lovable-uploads/311ac3d0-45e4-4761-8109-f7b3994ca369.png",
    alt: "Day Calendar View",
    title: "Day Calendar View"
  },
  {
    src: "/lovable-uploads/9cece89a-6b45-4cc5-a881-f505d89bd836.png",
    alt: "Week Calendar View",
    title: "Week Calendar View"
  },
  {
    src: "/lovable-uploads/b2d09117-fc50-44b7-a09e-9d0c29d73c09.png",
    alt: "Month Calendar View",
    title: "Month Calendar View"
  }
];

export const FeatureSection = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Booking Calendar",
      description: "Efficiently manage your appointments and events",
      carousel: calendarViews,
      benefits: [
        "Multiple calendar views (month, week, day)",
        "Event scheduling with customizable time slots",
        "Client booking management with payment tracking"
      ],
      showArrows: true
    },
    {
      icon: ChartBar,
      title: "Comprehensive Analytics",
      description: "Track your performance and growth",
      image: "/lovable-uploads/6ed3a140-619e-4555-8c77-60246cfb2077.png",
      benefits: [
        "Booking and revenue analytics",
        "Custom date range filtering",
        "Income comparison across months"
      ],
      reverse: true
    },
    {
      icon: ListTodo,
      title: "Task Management",
      description: "Stay organized and productive",
      image: "/lovable-uploads/9abedd44-1226-45b3-ab8e-cf31550ffddd.png",
      benefits: [
        "Kanban board for visual task organization",
        "Task status tracking and progress monitoring",
        "Efficient task prioritization"
      ]
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16">
          Powerful Features for Modern Professionals
        </h2>
        
        {features.map((feature, index) => (
          <FeatureCard key={index} {...feature} />
        ))}
      </div>
    </section>
  );
};