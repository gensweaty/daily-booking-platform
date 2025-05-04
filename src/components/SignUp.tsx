
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUpFields } from "./signup/SignUpFields";
import { useSignup } from "@/hooks/useSignup";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { validatePassword } from "@/utils/signupValidation";
import { useNavigate } from "react-router-dom";
import { logSignupDebug, logSignupError } from "@/utils/signupLogger";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface SignUpProps {
  setShowEmailAlert?: (show: boolean) => void;
}

export const SignUp = ({ setShowEmailAlert }: SignUpProps) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  
  const { handleSignup, isLoading } = useSignup();
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const clearForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setRedeemCode("");
    
    // Show email alert and update URL to indicate email was sent
    if (setShowEmailAlert) {
      setShowEmailAlert(true);
    }
    
    // Redirect to login page with email_sent parameter
    navigate('/login?email_sent=true');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    
    // Basic validation
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: t("auth.passwordsDoNotMatch"),
        variant: "destructive",
      });
      return;
    }

    // Use the shared validation function
    const passwordError = validatePassword(password);
    if (passwordError) {
      toast({
        title: "Error",
        description: passwordError,
        variant: "destructive",
      });
      return;
    }

    try {
      logSignupDebug('Starting signup submission', { email, username, hasRedeemCode: !!redeemCode });
      
      const result = await handleSignup(
        email, 
        username, 
        password, 
        confirmPassword, 
        redeemCode, 
        clearForm
      );
      
      if (result.error) {
        setSignupError(result.error);
        logSignupError('Signup error in component', result.error);
      }
    } catch (error: any) {
      logSignupError('Unhandled signup error', error);
      setSignupError(error.message || "An unexpected error occurred");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">{t("auth.signUpButton")}</h2>
      
      {signupError && (
        <Alert className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Signup Error</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {signupError}
            {signupError.includes("confirmation email") && (
              <>
                <br /><br />
                <strong>Try these solutions:</strong>
                <ul className="list-disc ml-5 mt-1">
                  <li>Check your spam folder for an email from SmartBookly</li>
                  <li>Try another email address</li>
                  <li>Contact support if the problem persists</li>
                </ul>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      
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
    </div>
  );
};
