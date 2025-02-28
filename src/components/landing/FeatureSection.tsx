
import { Calendar, ChartBar, ListTodo, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  
  const features = [
    {
      icon: Calendar,
      title: t('booking.title'),
      description: t('booking.description'),
      carousel: calendarViews,
      benefits: [
        t('booking.feature1'),
        t('booking.feature2'),
        t('booking.feature3'),
        t('booking.feature4')
      ],
      translationPrefix: 'booking' as const,
      id: "smart-booking"
    },
    {
      icon: ChartBar,
      title: t('analytics.title'),
      description: t('analytics.description'),
      image: "/lovable-uploads/2de2197d-0e7b-4d8c-b4a8-a0d30828d8be.png",
      benefits: [
        t('analytics.feature1'),
        t('analytics.feature2'),
        t('analytics.feature3'),
        t('analytics.feature4'),
        t('analytics.feature5')
      ],
      translationPrefix: 'analytics' as const,
      reverse: true,
      id: "analytics"
    },
    {
      icon: Users,
      title: t('crm.title'),
      description: t('crm.description'),
      image: "/lovable-uploads/84a5ef8b-fbd6-46dd-bb22-9378e67590d9.png",
      benefits: [
        t('crm.feature1'),
        t('crm.feature2'),
        t('crm.feature3'),
        t('crm.feature4'),
        t('crm.feature5')
      ],
      translationPrefix: 'crm' as const,
      id: "crm-solution"
    },
    {
      icon: ListTodo,
      title: t('tasks.title'),
      description: t('tasks.description'),
      image: "/lovable-uploads/f519fa18-e3d9-44a3-a449-70fc67e6f5de.png",
      benefits: [
        t('tasks.feature1'),
        t('tasks.feature2'),
        t('tasks.feature3'),
        t('tasks.feature4'),
        t('tasks.feature5')
      ],
      translationPrefix: 'tasks' as const,
      reverse: true,
      id: "task-management"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16">
          {t('features.mainTitle')}
        </h2>
        
        {features.map((feature, index) => (
          <div key={index} id={feature.id}>
            <FeatureCard {...feature} />
          </div>
        ))}
      </div>
    </section>
  );
};
