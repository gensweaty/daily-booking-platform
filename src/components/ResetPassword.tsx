import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { RequestResetForm } from "./password-reset/RequestResetForm";
import { UpdatePasswordForm } from "./password-reset/UpdatePasswordForm";

export const ResetPassword = () => {
  const [hasValidToken, setHasValidToken] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      const hash = window.location.hash;
      const accessToken = hash.split('access_token=')[1]?.split('&')[0];
      
      if (hash && hash.includes('type=recovery') && accessToken) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (!error && session) {
            setHasValidToken(true);
            return;
          }
          
          // Try to exchange the access token for a session
          const { error: signInError } = await supabase.auth.getUser(accessToken);
          
          if (!signInError) {
            setHasValidToken(true);
            return;
          }
        } catch (error) {
          console.error('Error validating token:', error);
        }
      }
      
      setHasValidToken(false);
    };

    checkRecoveryToken();
  }, [toast]);

  if (!hasValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <RequestResetForm />
        </div>
      </div>
    );
  }

  return <UpdatePasswordForm />;
};