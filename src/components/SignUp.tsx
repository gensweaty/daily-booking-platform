import { SignUpForm } from "./auth/SignUpForm";

export const SignUp = () => {
  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign Up</h2>
      <SignUpForm />
    </div>
  );
};