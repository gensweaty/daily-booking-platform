
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

interface ProfileButtonProps {
  onClick?: () => void;
  className?: string;
}

export const ProfileButton = ({ onClick, className }: ProfileButtonProps) => {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const getProfileText = () => {
    switch (language) {
      case 'ka':
        return 'პროფილი';
      case 'es':
        return 'Perfil';
      default:
        return 'Profile';
    }
  };

  return (
    <Button 
      variant="ghost" 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 h-auto ${className}`}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={user?.user_metadata?.avatar_url} />
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
          {user?.email?.charAt(0)?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">
        <LanguageText>{getProfileText()}</LanguageText>
      </span>
    </Button>
  );
};
