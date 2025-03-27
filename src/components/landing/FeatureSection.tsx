
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import FeatureCard from './FeatureCard';
import { Calendar, BarChart, Users, ListTodo } from 'lucide-react';

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

export const FeatureSection = () => {
  const { t } = useLanguage();
  
  const featuresList = [
    {
      iconUrl: "/lovable-uploads/2c659363-6837-44d0-9f56-4f0a5c8a2b74.png",
      title: t('booking.title'),
      description: t('booking.description'),
      features: [
        t('booking.feature1'),
        t('booking.feature2'),
        t('booking.feature3'),
        t('booking.feature4')
      ],
      id: "smart-booking"
    },
    {
      iconUrl: "/lovable-uploads/2de2197d-0e7b-4d8c-b4a8-a0d30828d8be.png",
      title: t('analytics.title'),
      description: t('analytics.description'),
      features: [
        t('analytics.feature1'),
        t('analytics.feature2'),
        t('analytics.feature3'),
        t('analytics.feature4'),
        t('analytics.feature5')
      ],
      id: "analytics"
    },
    {
      iconUrl: "/lovable-uploads/84a5ef8b-fbd6-46dd-bb22-9378e67590d9.png",
      title: t('crm.title'),
      description: t('crm.description'),
      features: [
        t('crm.feature1'),
        t('crm.feature2'),
        t('crm.feature3'),
        t('crm.feature4'),
        t('crm.feature5')
      ],
      id: "crm-solution"
    },
    {
      iconUrl: "/lovable-uploads/f519fa18-e3d9-44a3-a449-70fc67e6f5de.png",
      title: t('tasks.title'),
      description: t('tasks.description'),
      features: [
        t('tasks.feature1'),
        t('tasks.feature2'),
        t('tasks.feature3'),
        t('tasks.feature4'),
        t('tasks.feature5')
      ],
      id: "task-management"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16">
          {t('features.mainTitle')}
        </h2>
        
        <div className="flex flex-wrap -mx-4">
          {featuresList.map((feature, index) => (
            <div key={feature.id} id={feature.id}>
              <FeatureCard 
                title={feature.title}
                description={feature.description}
                icon={feature.iconUrl}
                features={feature.features}
                index={index}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
