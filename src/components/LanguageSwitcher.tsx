
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { LanguageText } from "./shared/LanguageText";

export const LanguageSwitcher = () => {
  const { language, updateLanguage, isLoading } = useUserLanguage();

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
      flag: "/lovable-uploads/112e2c85-5a54-4606-9d67-afe677501f2c.png"
    }
  };

  const handleLanguageChange = async (code: 'en' | 'es' | 'ka') => {
    if (isLoading) return;
    await updateLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative p-1" disabled={isLoading}>
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
            onClick={() => handleLanguageChange(code as 'en' | 'es' | 'ka')} 
            className={`flex items-center gap-2 hover:bg-accent cursor-pointer ${
              language === code ? 'bg-accent' : ''
            }`}
            disabled={isLoading}
          >
            <img 
              src={flag} 
              alt={code.toUpperCase()}
              className="w-5 h-5 rounded-full"
            />
            <LanguageText>{label}</LanguageText>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
