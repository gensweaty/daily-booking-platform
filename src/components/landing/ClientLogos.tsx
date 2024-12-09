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
      description: "Perfect for event planners and entertainment venues",
      bgColor: "bg-purple-100",
      iconColor: "text-purple-500"
    },
    { 
      name: "Health & Medicine", 
      icon: Stethoscope,
      description: "Ideal for medical practices and healthcare providers",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-500"
    },
    { 
      name: "Sports & Fitness", 
      icon: Dumbbell,
      description: "Great for gyms and fitness instructors",
      bgColor: "bg-green-100",
      iconColor: "text-green-500"
    },
    { 
      name: "Beauty & Wellness", 
      icon: Flower2,
      description: "Designed for spas and wellness centers",
      bgColor: "bg-pink-100",
      iconColor: "text-pink-500"
    },
    { 
      name: "Personal Meetings & Services", 
      icon: Users,
      description: "Perfect for consultants and service providers",
      bgColor: "bg-orange-100",
      iconColor: "text-orange-500"
    },
    { 
      name: "Education", 
      icon: GraduationCap,
      description: "Tailored for educational institutions and tutors",
      bgColor: "bg-teal-100",
      iconColor: "text-teal-500"
    },
  ];

  return (
    <div className="w-full bg-muted/30 py-12 mt-20">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-xl font-semibold mb-8 text-muted-foreground">
          For Small and Medium Business Like
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {logos.map((company, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center space-y-3 p-4 rounded-lg hover:bg-background/50 transition-all duration-300 hover:scale-105 group"
            >
              <div className={`p-4 rounded-full ${company.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                <company.icon className={`w-8 h-8 ${company.iconColor}`} />
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