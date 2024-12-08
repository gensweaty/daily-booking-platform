import { CheckCircle, Calendar, ChartBar, ListTodo } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";

const calendarViews = [
  {
    src: "/lovable-uploads/ed4a8c41-3ec8-4e80-8ccb-50c9ef495e30.png",
    alt: "Day View",
    title: "Day View"
  },
  {
    src: "/lovable-uploads/ce56f4f7-3f30-4f42-9b25-ff1d4d78be83.png",
    alt: "Week View",
    title: "Week View"
  },
  {
    src: "/lovable-uploads/16d738e7-9c5f-4ea4-b618-4c251886ef66.png",
    alt: "Month View",
    title: "Month View"
  },
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
        <h2 className="text-3xl font-bold text-center mb-16">Powerful Features for Modern Professionals</h2>
        
        {features.map((feature, index) => (
          <div key={index} className={`grid md:grid-cols-2 gap-12 items-center mb-20 ${
            feature.reverse ? 'md:flex-row-reverse' : ''
          }`}>
            <div className={`space-y-6 ${feature.reverse ? 'order-2 md:order-1' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-bold">{feature.title}</h3>
              </div>
              <p className="text-lg text-muted-foreground">{feature.description}</p>
              <ul className="space-y-3">
                {feature.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-primary mt-1" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`rounded-xl overflow-hidden shadow-xl bg-white p-4 ${
              feature.reverse ? 'order-1 md:order-2' : ''
            }`}>
              {feature.carousel ? (
                <ImageCarousel images={feature.carousel} />
              ) : (
                <img 
                  src={feature.image} 
                  alt={feature.title} 
                  className="w-full h-auto rounded-lg border border-gray-100"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};