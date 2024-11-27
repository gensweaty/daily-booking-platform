import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { RequestResetForm } from "./password-reset/RequestResetForm";
import { UpdatePasswordForm } from "./password-reset/UpdatePasswordForm";

export const ResetPassword = () => {
  const [hasValidToken, setHasValidToken] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      const hash = window.location.hash;
      const token = hash.split('access_token=')[1]?.split('&')[0];
      
      if (hash && hash.includes('type=recovery') && token) {
        try {
          // First verify the token is valid
          const { data: { user }, error } = await supabase.auth.getUser(token);
          
          if (!error && user) {
            // Set the session with the recovery token
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: '',
            });

            if (!sessionError) {
              setHasValidToken(true);
              setAccessToken(token);
              return;
            }
          }
        } catch (error) {
          console.error('Error validating token:', error);
        }
      }
      
      setHasValidToken(false);
      setAccessToken(null);
    };

    checkRecoveryToken();
  }, []);

  if (!hasValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <RequestResetForm />
        </div>
      </div>
    );
  }

  return <UpdatePasswordForm accessToken={accessToken} />;
};