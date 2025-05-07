
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface SignUpFieldsProps {
  email: string;
  setEmail: (email: string) => void;
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (confirmPassword: string) => void;
  redeemCode: string;
  setRedeemCode: (redeemCode: string) => void;
  isLoading: boolean;
}

export const SignUpFields = ({
  email,
  setEmail,
  username,
  setUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  redeemCode,
  setRedeemCode,
  isLoading
}: SignUpFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">
          {isGeorgian ? <GeorgianAuthText fontWeight="bold">მომხმარებლის სახელი</GeorgianAuthText> : t("auth.usernameLabel")}
        </Label>
        <Input
          id="username"
          type="text"
          placeholder={isGeorgian ? "მომხმარებლის სახელი" : t("auth.usernameLabel")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">
          {isGeorgian ? <GeorgianAuthText fontWeight="bold">ელექტრონული ფოსტა</GeorgianAuthText> : t("auth.emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={isGeorgian ? "ელექტრონული ფოსტა" : t("auth.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">
          {isGeorgian ? <GeorgianAuthText fontWeight="bold">პაროლი</GeorgianAuthText> : t("auth.passwordLabel")}
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={isGeorgian ? "პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს" : t("auth.passwordRequirements")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          {isGeorgian ? <GeorgianAuthText fontWeight="bold">პაროლის დადასტურება</GeorgianAuthText> : t("auth.confirmPasswordLabel")}
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={isGeorgian ? "პაროლის დადასტურება" : t("auth.confirmPasswordLabel")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="redeemCode">
          {isGeorgian ? <GeorgianAuthText fontWeight="bold">გამოსყიდვის კოდი (არასავალდებულო)</GeorgianAuthText> : t("auth.redeemCodeOptional")}
        </Label>
        <Input
          id="redeemCode"
          type="text"
          placeholder={isGeorgian ? "შეიყვანეთ თქვენი გამოსყიდვის კოდი" : t("auth.enterRedeemCode")}
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
          className="w-full"
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
