
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { TranslationKey } from '@/translations/types';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  features: string[];
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon, features, index }) => {
  const { t } = useLanguage();

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.2 * index,
        duration: 0.5,
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      className="w-full md:w-1/2 lg:w-1/3 px-4 mb-8"
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <Card className="h-full flex flex-col justify-between">
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <Avatar className="mr-4 w-12 h-12">
              <img src={icon} alt={title} className="rounded-full" />
            </Avatar>
            <h3 className="text-xl font-semibold">{t(title)}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t(description)}</p>
          <ul>
            {features.map((feature, featureIndex) => (
              <li key={featureIndex} className="mb-2 flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                {t(feature.toString())}
              </li>
            ))}
          </ul>
        </CardContent>
        <div className="p-6">
          <Button variant="secondary">{t('common.learnMore')}</Button>
        </div>
      </Card>
    </motion.div>
  );
};

export default FeatureCard;
