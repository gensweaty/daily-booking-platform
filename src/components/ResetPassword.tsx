import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { RequestResetForm } from "./password-reset/RequestResetForm";
import { UpdatePasswordForm } from "./password-reset/UpdatePasswordForm";
import { useNavigate } from "react-router-dom";

export const ResetPassword = () => {
  const [hasValidToken, setHasValidToken] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const accessToken = params.get('access_token');
        
        if (type === 'recovery' && accessToken) {
          // Set the access token in the session
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: accessToken,
          });

          if (error) {
            throw error;
          }

          setHasValidToken(true);
        } else {
          // If no valid token, show the request form
          setHasValidToken(false);
        }
      } catch (error) {
        console.error('Error checking recovery token:', error);
        setHasValidToken(false);
        toast({
          title: "Error",
          description: "Invalid or expired recovery link. Please request a new one.",
          variant: "destructive",
        });
        navigate("/reset-password");
      }
    };

    checkRecoveryToken();
  }, [navigate, toast]);

  if (!hasValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <RequestResetForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <UpdatePasswordForm />
      </div>
    </div>
  );
};