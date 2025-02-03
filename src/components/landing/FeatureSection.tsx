import { Calendar, ChartBar, ListTodo, Users } from "lucide-react";

const calendarViews = [
  {
    src: "/lovable-uploads/729a5752-6967-4e92-97b1-320ef1479952.png",
    alt: "Day View",
    title: "Day View"
  },
  {
    src: "/lovable-uploads/5eaaed29-3f1c-4a89-88a5-c93168076cdc.png",
    alt: "Week View",
    title: "Week View"
  },
  {
    src: "/lovable-uploads/a8b02dd4-b4a0-489c-84e2-d9f78cd4d039.png",
    alt: "Month View",
    title: "Month View"
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
      image: "/lovable-uploads/88db91f1-2c5b-4da1-a62a-5f194dc429a1.png",
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
      image: "/lovable-uploads/6e75e8c4-d994-4533-96f5-cb4c2b60936e.png",
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
      image: "/lovable-uploads/8a5e9b4a-8d20-4dc8-b251-ccb9233f112c.png",
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