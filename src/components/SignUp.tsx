
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUpFields } from "./signup/SignUpFields";
import { useSignup } from "@/hooks/useSignup";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertCircle, AlertTriangle } from "lucide-react";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  
  const { handleSignup, isLoading } = useSignup();
  const { toast } = useToast();
  const { t } = useLanguage();

  const clearForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setRedeemCode("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: t("auth.passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: t("auth.passwordTooShort"),
        variant: "destructive",
      });
      return;
    }

    await handleSignup(email, username, password, confirmPassword, redeemCode, clearForm);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">{t("auth.signUpButton")}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <SignUpFields
          email={email}
          setEmail={setEmail}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          redeemCode={redeemCode}
          setRedeemCode={setRedeemCode}
          isLoading={isLoading}
        />
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? t("auth.signingUp") : t("auth.signUpButton")}
        </Button>
      </form>
      
      <div className="mt-6 text-sm text-muted-foreground space-y-2">
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p><strong>Important:</strong> After signing up, you MUST click the verification link sent to your email to activate your account.</p>
            <p className="mt-1">Please check both your inbox and spam folders for the confirmation email.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
