
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { Flag } from "lucide-react";

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  const languages = {
    en: {
      label: "English (EN)",
      flag: "🇺🇸"
    },
    es: {
      label: "Español (ES)",
      flag: "🇪🇸"
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          {language === 'en' ? (
            <span className="text-lg" role="img" aria-label="English">
              {languages.en.flag}
            </span>
          ) : (
            <span className="text-lg" role="img" aria-label="Spanish">
              {languages.es.flag}
            </span>
          )}
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setLanguage('en')} 
          className={`flex items-center gap-2 ${language === 'en' ? 'bg-accent' : ''}`}
        >
          <span className="text-lg" role="img" aria-label="English">
            {languages.en.flag}
          </span>
          {languages.en.label}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('es')} 
          className={`flex items-center gap-2 ${language === 'es' ? 'bg-accent' : ''}`}
        >
          <span className="text-lg" role="img" aria-label="Spanish">
            {languages.es.flag}
          </span>
          {languages.es.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
