
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUpFields } from "./signup/SignUpFields";
import { useSignup } from "@/hooks/useSignup";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Mail, AlertCircle, RefreshCw } from "lucide-react";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  
  const { handleSignup, resendConfirmationEmail, isLoading, errorType } = useSignup();
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

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address first",
        variant: "destructive",
      });
      return;
    }
    
    await resendConfirmationEmail(email);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">{t("auth.signUpButton")}</h2>
      
      {errorType === "email_confirmation_pending" && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <Mail className="h-4 w-4" />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            We've sent a confirmation email to <strong>{email}</strong>.
            Please check your inbox and spam folder to activate your account.
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResendEmail}
            className="mt-2"
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Resend Email
          </Button>
        </Alert>
      )}
      
      {errorType === "email_confirmation_failed" && (
        <Alert className="mb-6 border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Email Confirmation Failed</AlertTitle>
          <AlertDescription>
            <p>Our system is having trouble sending confirmation emails. Please try:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Using a different email address</li>
              <li>Checking if you've already registered with this email</li>
              <li>Trying again later</li>
            </ul>
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
