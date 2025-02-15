
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
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative p-1">
          <img 
            src={language === 'en' ? languages.en.flag : languages.es.flag}
            alt={language === 'en' ? "English" : "Spanish"}
            className="w-full h-full object-cover rounded-full"
          />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setLanguage('en')} 
          className={`flex items-center gap-2 ${language === 'en' ? 'bg-accent' : ''}`}
        >
          <img 
            src={languages.en.flag} 
            alt="English"
            className="w-5 h-5 rounded-full"
          />
          {languages.en.label}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('es')} 
          className={`flex items-center gap-2 ${language === 'es' ? 'bg-accent' : ''}`}
        >
          <img 
            src={languages.es.flag} 
            alt="Spanish"
            className="w-5 h-5 rounded-full"
          />
          {languages.es.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
