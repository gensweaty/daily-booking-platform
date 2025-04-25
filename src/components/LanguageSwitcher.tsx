
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  const languages = {
    en: {
      label: "English (EN)",
      flag: "/lovable-uploads/73eec4c3-e701-4219-bb57-349d6cdac1a0.png"
    },
    es: {
      label: "Español (ES)",
      flag: "/lovable-uploads/bdc6065f-d812-4ae9-98d9-81472f814981.png"
    },
    ka: {
      label: "ქართული (KA)",
      flag: "/lovable-uploads/georgian-flag.png" // You'll need to upload a Georgian flag
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative p-1">
          <img 
            src={languages[language].flag}
            alt={language === 'en' ? "English" : language === 'es' ? "Spanish" : "Georgian"}
            className="w-full h-full object-cover rounded-full"
          />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-background border shadow-lg min-w-[150px] z-50"
        sideOffset={8}
      >
        {Object.entries(languages).map(([code, { label, flag }]) => (
          <DropdownMenuItem 
            key={code}
            onClick={() => setLanguage(code as 'en' | 'es' | 'ka')} 
            className={`flex items-center gap-2 hover:bg-accent cursor-pointer ${
              language === code ? 'bg-accent' : ''
            }`}
          >
            <img 
              src={flag} 
              alt={code.toUpperCase()}
              className="w-5 h-5 rounded-full"
            />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
