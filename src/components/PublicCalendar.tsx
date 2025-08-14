import { Calendar } from "@/components/Calendar/Calendar";
import { PublicBoardAuthContext } from "@/components/PublicBoardNavigation";

interface PublicCalendarProps {
  boardUserId: string;
}

export const PublicCalendar = ({ boardUserId }: PublicCalendarProps) => {
  const mockAuth = {
    user: { id: boardUserId, email: "" },
  };

  return (
    <PublicBoardAuthContext.Provider value={mockAuth}>
      <div className="w-full">
        <Calendar defaultView="month" />
      </div>
    </PublicBoardAuthContext.Provider>
  );
};