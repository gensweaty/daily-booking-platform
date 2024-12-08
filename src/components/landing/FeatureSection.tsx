import { CheckCircle, Calendar, ChartBar, ListTodo } from "lucide-react";

export const FeatureSection = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Booking Calendar",
      description: "Efficiently manage your appointments and events",
      image: "/calendar-preview.png",
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
      image: "/analytics-preview.png",
      benefits: [
        "Booking and revenue analytics",
        "Custom date range filtering",
        "Income comparison across months"
      ]
    },
    {
      icon: ListTodo,
      title: "Task Management",
      description: "Stay organized and productive",
      image: "/tasks-preview.png",
      benefits: [
        "Kanban board for visual task organization",
        "Task status tracking and progress monitoring",
        "File attachments support"
      ]
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16">Powerful Features for Modern Professionals</h2>
        
        {features.map((feature, index) => (
          <div key={index} className={`grid md:grid-cols-2 gap-12 items-center mb-20 ${
            index % 2 === 1 ? 'md:flex-row-reverse' : ''
          }`}>
            <div className="space-y-6">
              <div className="inline-block p-2 bg-primary/10 rounded-lg mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">{feature.title}</h3>
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
            <div className={`rounded-lg overflow-hidden shadow-xl ${
              index % 2 === 1 ? 'order-first md:order-last' : ''
            }`}>
              <img 
                src={feature.image} 
                alt={feature.title} 
                className="w-full border border-border rounded-lg shadow-lg"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};