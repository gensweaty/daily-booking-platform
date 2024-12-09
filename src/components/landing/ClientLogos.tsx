import { motion } from "framer-motion";
import { 
  PartyPopper, 
  Stethoscope, 
  Dumbbell, 
  Flower2, 
  Users, 
  GraduationCap 
} from "lucide-react";

export const ClientLogos = () => {
  const logos = [
    { 
      name: "Events & Entertainment", 
      icon: PartyPopper,
      description: "Perfect for event planners and entertainment venues"
    },
    { 
      name: "Health & Medicine", 
      icon: Stethoscope,
      description: "Ideal for medical practices and healthcare providers"
    },
    { 
      name: "Sports & Fitness", 
      icon: Dumbbell,
      description: "Great for gyms and fitness instructors"
    },
    { 
      name: "Beauty & Wellness", 
      icon: Flower2,
      description: "Designed for spas and wellness centers"
    },
    { 
      name: "Personal Meetings & Services", 
      icon: Users,
      description: "Perfect for consultants and service providers"
    },
    { 
      name: "Education", 
      icon: GraduationCap,
      description: "Tailored for educational institutions and tutors"
    },
  ];

  return (
    <div className="w-full bg-muted/30 py-12 mt-20">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-xl font-semibold mb-8 text-muted-foreground">
          For Small and Medium Business Like
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {logos.map((company, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center space-y-3 p-4 rounded-lg hover:bg-background/50 transition-colors"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <company.icon className="w-8 h-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-center">{company.name}</span>
              <span className="text-xs text-muted-foreground text-center hidden lg:block">
                {company.description}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};