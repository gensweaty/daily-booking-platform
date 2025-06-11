
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { User } from "lucide-react";

interface ProfileButtonProps {
  onClick?: () => void;
  className?: string;
  mobileVersion?: boolean;
  avatarUrl?: string | null;
  onRedeemClick?: () => void;
}

export const ProfileButton = ({ 
  onClick, 
  className, 
  mobileVersion = false, 
  avatarUrl,
  onRedeemClick
}: ProfileButtonProps) => {
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

  if (mobileVersion) {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        onClick={onClick}
        className={`h-10 w-10 rounded-full p-0 border border-gray-300 dark:border-gray-600 ${className}`}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {user?.email?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  return (
    <Button 
      variant="ghost" 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 h-auto border border-gray-300 dark:border-gray-600 ${className}`}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
          {user?.email?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">
        <LanguageText>{getProfileText()}</LanguageText>
      </span>
    </Button>
  );
};
