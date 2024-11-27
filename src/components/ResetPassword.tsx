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
        
        if (type === 'recovery') {
          setHasValidToken(true);
        } else {
          // If no valid token, show the request form
          setHasValidToken(false);
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