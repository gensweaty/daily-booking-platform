
/**
 * Helper functions to standardize logging during signup flow
 */

// Standard log for signup steps
export const logSignupStep = (step: string, data?: any) => {
  console.log(`📝 SIGNUP [${step}]:`, data || '');
};

// Error log for signup steps
export const logSignupError = (step: string, error: any) => {
  console.error(`❌ SIGNUP ERROR [${step}]:`, error);
};

// Debug log for detailed information
export const logSignupDebug = (message: string, data?: any) => {
  console.log(`🔍 SIGNUP DEBUG: ${message}`, data || '');
};
