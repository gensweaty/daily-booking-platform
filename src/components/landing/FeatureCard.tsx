import { LucideIcon } from "lucide-react";
import { CheckCircle } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";

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
    <div className={`grid md:grid-cols-2 gap-12 items-center mb-20 ${
      reverse ? 'md:flex-row-reverse' : ''
    }`}>
      <div className={`space-y-6 ${reverse ? 'order-2 md:order-1' : ''}`}>
        <div className="flex items-center gap-3 mb-4">
          <Icon className="w-6 h-6 text-primary" />
          <h3 className="text-2xl font-bold">{title}</h3>
        </div>
        <p className="text-lg text-muted-foreground">{description}</p>
        <ul className="space-y-3">
          {benefits.map((benefit, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-primary mt-1" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`relative ${reverse ? 'order-1 md:order-2' : ''}`}>
        <div className="rounded-xl overflow-hidden shadow-xl bg-white">
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
      </div>
    </div>
  );
};