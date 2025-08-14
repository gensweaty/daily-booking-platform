import { Statistics } from "@/components/Statistics";
import { PublicBoardAuthContext } from "@/components/PublicBoardNavigation";

interface PublicStatisticsProps {
  boardUserId: string;
}

export const PublicStatistics = ({ boardUserId }: PublicStatisticsProps) => {
  const mockAuth = {
    user: { id: boardUserId, email: "" },
  };

  return (
    <PublicBoardAuthContext.Provider value={mockAuth}>
      <div className="w-full">
        <Statistics />
      </div>
    </PublicBoardAuthContext.Provider>
  );
};