
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUpFields } from "./signup/SignUpFields";
import { useSignup } from "@/hooks/useSignup";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertCircle, Link as LinkIcon } from "lucide-react";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [confirmationLink, setConfirmationLink] = useState("");
  
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
    setConfirmationLink("");
    
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

    const result = await handleSignup(email, username, password, confirmPassword, redeemCode, clearForm);
    
    // If we have a confirmation link (development mode or for testing), show it
    if (result?.confirmationLink) {
      setConfirmationLink(result.confirmationLink);
      
      // Copy link to clipboard for convenience
      try {
        await navigator.clipboard.writeText(result.confirmationLink);
        toast({
          title: "Confirmation Link Copied",
          description: "The verification link has been copied to your clipboard",
          duration: 5000,
        });
      } catch (e) {
        console.error("Could not copy to clipboard:", e);
      }
    }
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
            <p>After signing up, please check your inbox (and spam folder) for a confirmation email.</p>
            <p className="mt-1">You'll need to click the confirmation link to activate your account.</p>
          </div>
        </div>
        
        {confirmationLink && (
          <div className="p-3 mt-4 border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 rounded-md">
            <div className="flex items-center justify-between">
              <p className="font-medium text-blue-800 dark:text-blue-300">Development Mode: Confirmation Link</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                onClick={() => {
                  navigator.clipboard.writeText(confirmationLink);
                  toast({
                    title: "Copied!",
                    description: "Link copied to clipboard",
                    duration: 2000,
                  });
                }}
              >
                <LinkIcon className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
            <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">
              For testing only - click this link to confirm your account
              <br />
              <span className="opacity-75">(Normally this would be sent by email, but Resend is in test mode)</span>
            </p>
            <a 
              href={confirmationLink} 
              className="mt-2 block text-xs break-all text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank" 
              rel="noopener noreferrer"
            >
              {confirmationLink}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

