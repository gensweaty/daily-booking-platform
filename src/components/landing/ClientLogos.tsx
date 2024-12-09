import { motion } from "framer-motion";

export const ClientLogos = () => {
  const logos = [
    { name: "Company 1", logo: "🏢" },
    { name: "Company 2", logo: "🏛️" },
    { name: "Company 3", logo: "🏗️" },
    { name: "Company 4", logo: "🏤" },
    { name: "Company 5", logo: "🏪" },
  ];

  return (
    <div className="w-full bg-muted/30 py-12 mt-20">
      <div className="container mx-auto px-4">
        <h3 className="text-center text-xl font-semibold mb-8 text-muted-foreground">
          Trusted by Leading Companies
        </h3>
        <div className="flex justify-around items-center gap-8 overflow-x-auto pb-4">
          {logos.map((company, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center space-y-2 min-w-[100px]"
            >
              <span className="text-4xl">{company.logo}</span>
              <span className="text-sm text-muted-foreground">{company.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};