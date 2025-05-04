
import { PostgrestError } from '@supabase/supabase-js';

export const validatePassword = (password: string) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  
  // Validate with other password requirements (from your screenshot)
  // Currently set to "No required characters (default)"
  
  return null;
};

export const validateUsername = async (username: string, supabase: any) => {
  if (username.length < 3) {
    return "Username must be at least 3 characters long";
  }

  try {
    const { data: existingUsers, error: fetchError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username);

    if (fetchError) {
      console.error('Error checking username:', fetchError);
      return null; // Allow signup to proceed if we can't check
    }

    if (existingUsers && existingUsers.length > 0) {
      return "This username is already taken. Please choose another one.";
    }
  } catch (error) {
    console.error('Username validation error:', error);
  }

  return null;
};
