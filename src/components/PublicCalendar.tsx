import { Calendar } from "@/components/Calendar/Calendar";
import { usePublicBoardAuth } from "@/components/PublicBoardNavigation";

interface PublicCalendarProps {
  boardUserId: string;
}

export const PublicCalendar = ({ boardUserId }: PublicCalendarProps) => {
  // Override the auth context for the calendar to use the board user ID
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
      <Calendar defaultView="month" />
    </div>
  );
};