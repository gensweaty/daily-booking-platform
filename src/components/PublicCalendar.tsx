import { Calendar } from "@/components/Calendar/Calendar";
import { AuthOverrideProvider } from "./PublicAuthProvider";

interface PublicCalendarProps {
  boardUserId: string;
}

export const PublicCalendar = ({ boardUserId }: PublicCalendarProps) => {
  return (
    <AuthOverrideProvider userId={boardUserId}>
      <Calendar defaultView="month" />
    </AuthOverrideProvider>
  );
};