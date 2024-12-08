import { Calendar, ChartBar, ListTodo } from "lucide-react";
import { FeatureCard } from "./FeatureCard";

const calendarViews = [
  {
    src: "/lovable-uploads/c4430958-5d5d-46a8-97ed-7378c4f15b1e.png",
    alt: "Day View Calendar",
    title: "Day View"
  },
  {
    src: "/lovable-uploads/5969dfdd-614f-499e-a670-fb5348c50ff9.png",
    alt: "Week View Calendar",
    title: "Week View"
  },
  {
    src: "/lovable-uploads/7f9abac0-265d-4a11-bc2a-35b7732ba899.png",
    alt: "Month View Calendar",
    title: "Month View"
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
