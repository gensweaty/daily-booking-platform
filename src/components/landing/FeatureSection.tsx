import { Calendar, ChartBar, ListTodo, Users } from "lucide-react";

const calendarViews = [
  {
    src: "/lovable-uploads/2c659363-6837-44d0-9f56-4f0a5c8a2b74.png",
    alt: "Month View",
  },
  {
    src: "/lovable-uploads/400e814b-7812-448a-9e9a-9036616aab00.png",
    alt: "Week View",
  },
  {
    src: "/lovable-uploads/541c86d2-6a17-4ec4-9a9c-5ad9e6e3ba4d.png",
    alt: "Day View",
  },
];

import { FeatureCard } from "./FeatureCard";

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
      ]
    },
    {
      icon: ChartBar,
      title: "Comprehensive Analytics",
      description: "Track your performance and growth",
      image: "/lovable-uploads/2de2197d-0e7b-4d8c-b4a8-a0d30828d8be.png",
      benefits: [
        "Booking and revenue analytics",
        "Custom date range filtering",
        "Income comparison across months"
      ],
      reverse: true
    },
    {
      icon: Users,
      title: "Customer Relationship Management",
      description: "Build and maintain strong client relationships",
      image: "/lovable-uploads/84a5ef8b-fbd6-46dd-bb22-9378e67590d9.png",
      benefits: [
        "Centralized customer information management",
        "File attachments and document organization",
        "Payment tracking and status monitoring"
      ]
    },
    {
      icon: ListTodo,
      title: "Task Management",
      description: "Stay organized and productive",
      image: "/lovable-uploads/f519fa18-e3d9-44a3-a449-70fc67e6f5de.png",
      benefits: [
        "Kanban board for visual task organization",
        "Task status tracking and progress monitoring",
        "Efficient task prioritization"
      ],
      reverse: true
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