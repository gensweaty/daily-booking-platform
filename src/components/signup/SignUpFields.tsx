
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="username">{t("auth.usernameLabel")}</Label>
        <Input
          id="username"
          type="text"
          placeholder={t("auth.usernameLabel")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
        <Input
          id="password"
          type="password"
          placeholder={t("auth.passwordRequirements")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("auth.confirmPasswordLabel")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder={t("auth.confirmPasswordLabel")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="redeemCode" className="flex items-center gap-2">
          Redeem Code
          <span className="text-sm text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          id="redeemCode"
          type="text"
          placeholder="Enter your redeem code"
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
          className="w-full"
          disabled={isLoading}
        />
      </div>
    </>
  );
};
