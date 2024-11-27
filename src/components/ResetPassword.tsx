import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { RequestResetForm } from "./password-reset/RequestResetForm";
import { UpdatePasswordForm } from "./password-reset/UpdatePasswordForm";

export const ResetPassword = () => {
  const [hasValidToken, setHasValidToken] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!error && session) {
          setHasValidToken(true);
          return;
        }

        // If no session, check for recovery token in URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const type = params.get('type');
        
        if (token && type === 'recovery') {
          setHasValidToken(true);
        }
      } catch (error) {
        console.error('Error checking recovery token:', error);
        setHasValidToken(false);
      }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <UpdatePasswordForm />
      </div>
    </div>
  );
};