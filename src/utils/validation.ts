export const validatePassword = (password: string) => {
  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};

export const validateUsername = (username: string) => {
  if (username.length < 3) {
    return "Username must be at least 3 characters long";
  }
  return null;
};