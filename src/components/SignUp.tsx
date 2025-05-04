
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
import { AlertTriangle, AlertCircle, Mail, Loader2 } from "lucide-react";
import { testSendConfirmationEmail } from "@/lib/supabase";

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
  const [completedSignup, setCompletedSignup] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendResult, setResendResult] = useState<{success: boolean, message?: string} | null>(null);
  
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
    setCompletedSignup(true);
    
    // Show email alert and update URL to indicate email was sent
    if (setShowEmailAlert) {
      setShowEmailAlert(true);
    }
    
    // Redirect to login page with email_sent parameter
    navigate('/login?email_sent=true');
  };

  const handleResendConfirmation = async () => {
    if (!email || resendingEmail) return;

    try {
      setResendingEmail(true);
      setResendResult(null);
      
      logSignupDebug('Attempting to manually resend confirmation email', { email });
      const result = await testSendConfirmationEmail(email);
      
      setResendResult(result);
      
      if (result.success) {
        toast({
          title: "Confirmation Email Resent",
          description: "Please check your inbox and spam folders for the confirmation email.",
          duration: 6000,
        });
      } else {
        toast({
          title: "Failed to Resend Email",
          description: result.error || "There was an issue sending the confirmation email.",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error: any) {
      logSignupError('Error in manual resend', error);
      setResendResult({
        success: false,
        message: error.message || "An unexpected error occurred"
      });
      
      toast({
        title: "Error",
        description: "Failed to resend confirmation email. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setResendResult(null);
    
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
                  <li>Try another email address (Gmail or Outlook recommended)</li>
                  <li>Click the "Resend Confirmation" button below</li>
                  <li>Contact support if the problem persists</li>
                </ul>
                
                <div className="mt-4">
                  <Button 
                    onClick={handleResendConfirmation}
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    disabled={resendingEmail || !email}
                  >
                    {resendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Resend Confirmation Email
                      </>
                    )}
                  </Button>
                </div>
                
                {resendResult && (
                  <div className="mt-4 p-2 border rounded text-sm">
                    {resendResult.success ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        Confirmation email sent! Please check your inbox and spam folders.
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">
                        Failed to send: {resendResult.message || "Unknown error"}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {completedSignup ? (
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Check your email</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <p className="mb-2">
              A confirmation email has been sent to <strong>{email}</strong>. Please check both your <strong>inbox and spam folder</strong> to verify your account.
            </p>
            <p className="text-xs mb-2">
              If you don't receive the email within a few minutes:
            </p>
            <ul className="list-disc ml-5 text-xs mb-3">
              <li>Check your spam/junk folder</li>
              <li>Try signing up with a Gmail or Outlook email</li>
              <li>Contact support if problems persist</li>
            </ul>
            
            <div className="mt-2">
              <Button 
                onClick={handleResendConfirmation}
                variant="outline"
                className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                disabled={resendingEmail}
                size="sm"
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-3 w-3" />
                    Resend Confirmation Email
                  </>
                )}
              </Button>
            </div>
            
            {resendResult && (
              <div className="mt-3 p-2 border rounded text-sm">
                {resendResult.success ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Confirmation email sent! Please check your inbox and spam folders.
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    Failed to send: {resendResult.message || "Unknown error"}
                  </span>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ) : (
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
      )}
    </div>
  );
};
