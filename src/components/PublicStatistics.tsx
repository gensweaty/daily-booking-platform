import { Statistics } from "@/components/Statistics";

interface PublicStatisticsProps {
  boardUserId: string;
}

export const PublicStatistics = ({ boardUserId }: PublicStatisticsProps) => {
  // Override the auth context for Statistics to use the board user ID
  const originalAuthHook = require("@/contexts/AuthContext").useAuth;
  
  // Mock the auth context to return the board user
  const mockAuth = {
    user: { id: boardUserId },
    loading: false,
    signOut: () => {},
    signIn: () => {},
    signUp: () => {}
  };

  // Temporarily override the auth context
  require("@/contexts/AuthContext").useAuth = () => mockAuth;

  return (
    <div className="w-full">
      <Statistics />
    </div>
  );
};