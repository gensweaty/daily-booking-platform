
import { SupabaseClient } from '@supabase/supabase-js';
import { logSignupDebug, logSignupError, logSignupStep } from './signupLogger';
import { toast } from '@/hooks/use-toast';

export interface RedeemCodeValidationResult {
  is_valid: boolean;
  code_id: string | null;
  error_message: string | null;
}

/**
 * Validates a redeem code with the Supabase RPC
 */
export const validateRedeemCode = async (
  supabase: SupabaseClient,
  code: string
): Promise<{ isValid: boolean; codeId: string | null; errorMessage: string | null }> => {
  if (!code.trim()) {
    return { isValid: false, codeId: null, errorMessage: null };
  }

  try {
    const trimmedCode = code.trim();
    logSignupStep('Checking redeem code', trimmedCode);

    const { data: result, error } = await supabase.rpc('check_and_lock_redeem_code', {
      p_code: trimmedCode
    });

    logSignupDebug('Raw redeem code RPC response:', result);

    if (error) {
      logSignupError('Redeem code check', error);
      toast({
        title: "Error",
        description: "Error checking redeem code",
        variant: "destructive",
        duration: 5000,
      });
      return { isValid: false, codeId: null, errorMessage: error.message };
    }

    // Handle the object response from RPC
    if (!result || typeof result !== 'object') {
      logSignupError('Invalid redeem code response', result);
      return { 
        isValid: false, 
        codeId: null, 
        errorMessage: "Unexpected response from server when validating redeem code."
      };
    }

    const validationResult = result as RedeemCodeValidationResult;
    logSignupDebug('Code validation result:', validationResult);

    return { 
      isValid: validationResult.is_valid, 
      codeId: validationResult.code_id, 
      errorMessage: validationResult.error_message 
    };
  } catch (error) {
    logSignupError('Redeem code validation exception', error);
    return { 
      isValid: false, 
      codeId: null, 
      errorMessage: error instanceof Error ? error.message : "Unknown error validating code" 
    };
  }
};
