import { Statistics } from "@/components/Statistics";
import { AuthOverrideProvider } from "./PublicAuthProvider";

interface PublicStatisticsProps {
  boardUserId: string;
}

export const PublicStatistics = ({ boardUserId }: PublicStatisticsProps) => {
  return (
    <AuthOverrideProvider userId={boardUserId}>
      <Statistics />
    </AuthOverrideProvider>
  );
};