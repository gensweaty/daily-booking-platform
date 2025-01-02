export const validatePassword = (password: string) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};

export const validateUsername = async (username: string, supabase: any) => {
  if (username.length < 3) {
    return "Username must be at least 3 characters long";
  }

  const { data: existingUsers, error: fetchError } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username);

  if (fetchError) throw fetchError;

  if (existingUsers && existingUsers.length > 0) {
    return "This username is already taken. Please choose another one.";
  }

  return null;
};