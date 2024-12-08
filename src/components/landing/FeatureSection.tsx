import { Calendar, ChartBar, ListTodo } from "lucide-react";

const calendarViews = [
  {
    src: "/lovable-uploads/b7231719-c483-4e3b-a30c-4242b4b6db3e.png",
    alt: "Day View",
    title: "Day View"
  },
  {
    src: "/lovable-uploads/63f13d75-043b-402f-b44a-35623b159ab4.png",
    alt: "Week View",
    title: "Week View"
  },
  {
    src: "/lovable-uploads/707283fa-2b49-4f39-809e-6201fa8c5ccd.png",
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