
import { Calendar, ChartBar, ListTodo, Users, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClientLogos } from "./ClientLogos";
import { FeatureButtons } from "./FeatureButtons";

// Updated to ensure all carousel images have consistent padding
const calendarViews = [{
  src: "/lovable-uploads/89e4fa80-68d7-48c3-b9d4-b8ac38c657b6.png",
  alt: "Booking Calendar",
  customStyle: "object-contain",
  customPadding: "p-4" // Consistent padding for all images
}, {
  src: "/lovable-uploads/400e814b-7812-448a-9e9a-9036616aab00.png",
  alt: "Week View",
  customStyle: "object-contain",
  customPadding: "p-4" // Adding padding to second image
}, {
  src: "/lovable-uploads/541c86d2-6a17-4ec4-9a9c-5ad9e6e3ba4d.png",
  alt: "Day View",
  customStyle: "object-contain",
  customPadding: "p-4" // Adding padding to third image
}];

import { FeatureCard } from "./FeatureCard";

export const FeatureSection = () => {
  const {
    t
  } = useLanguage();
  const features = [{
    icon: Globe,
    title: t('website.title'),
    description: t('website.description'),
    image: "/lovable-uploads/70d5dbd5-33c5-4a79-8e5d-f70268175828.png",
    benefits: [t('website.feature1'), t('website.feature2'), t('website.feature3'), t('website.feature4'), t('website.feature5')],
    translationPrefix: 'website' as const,
    id: "booking-website",
    reverse: false
  }, {
    icon: Calendar,
    title: t('booking.title'),
    description: t('booking.description'),
    carousel: calendarViews,
    benefits: [t('booking.feature1'), t('booking.feature2'), t('booking.feature3'), t('booking.feature4'), t('booking.feature5')],
    translationPrefix: 'booking' as const,
    id: "smart-booking",
    reverse: true
  }, {
    icon: ChartBar,
    title: t('analytics.title'),
    description: t('analytics.description'),
    image: "/lovable-uploads/2de2197d-0e7b-4d8c-b4a8-a0d30828d8be.png",
    benefits: [t('analytics.feature1'), t('analytics.feature2'), t('analytics.feature3'), t('analytics.feature4'), t('analytics.feature5')],
    translationPrefix: 'analytics' as const,
    id: "analytics",
    reverse: false
  }, {
    icon: Users,
    title: t('crm.title'),
    description: t('crm.description'),
    image: "/lovable-uploads/84a5ef8b-fbd6-46dd-bb22-9378e67590d9.png",
    benefits: [t('crm.feature1'), t('crm.feature2'), t('crm.feature3'), t('crm.feature4'), t('crm.feature5')],
    translationPrefix: 'crm' as const,
    id: "crm-solution",
    reverse: true
  }, {
    icon: ListTodo,
    title: t('tasks.title'),
    description: t('tasks.description'),
    image: "/lovable-uploads/f519fa18-e3d9-44a3-a449-70fc67e6f5de.png",
    benefits: [t('tasks.feature1'), t('tasks.feature2'), t('tasks.feature3'), t('tasks.feature4'), t('tasks.feature5')],
    translationPrefix: 'tasks' as const,
    id: "task-management",
    reverse: false
  }];
  return <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <FeatureButtons />
        <ClientLogos />
        {features.map((feature, index) => <div key={index} id={feature.id}>
            <FeatureCard {...feature} />
          </div>)}
      </div>
    </section>;
};
