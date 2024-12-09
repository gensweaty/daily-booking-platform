import { LucideIcon } from "lucide-react";
import { CheckCircle } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";
import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
  image?: string;
  carousel?: {
    src: string;
    alt: string;
    title?: string;
  }[];
  reverse?: boolean;
}

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  benefits,
  image,
  carousel,
  reverse,
}: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`grid md:grid-cols-2 gap-12 items-center mb-20 ${
        reverse ? 'md:flex-row-reverse' : ''
      }`}
    >
      <div className={`space-y-6 ${reverse ? 'order-2 md:order-1' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {title}
          </h3>
        </div>
        <p className="text-lg text-muted-foreground">{description}</p>
        <ul className="space-y-3">
          {benefits.map((benefit, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-2"
            >
              <CheckCircle className="w-5 h-5 text-primary mt-1" />
              <span>{benefit}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <motion.div
        initial={{ opacity: 0, x: reverse ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className={`relative ${reverse ? 'order-1 md:order-2' : ''}`}
      >
        <div className="rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-white">
          {carousel ? (
            <ImageCarousel 
              images={carousel} 
              className="mx-[-1rem]"
              permanentArrows={true}
            />
          ) : (
            <img 
              src={image} 
              alt={title} 
              className="w-full h-[400px] object-contain p-4"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};