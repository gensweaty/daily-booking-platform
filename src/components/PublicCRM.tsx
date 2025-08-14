import { CRMWithPermissions } from "@/components/crm/CRMWithPermissions";
import { PublicBoardAuthContext } from "@/components/PublicBoardNavigation";

interface PublicCRMProps {
  boardUserId: string;
}

export const PublicCRM = ({ boardUserId }: PublicCRMProps) => {
  const mockAuth = {
    user: { id: boardUserId, email: "" },
  };

  return (
    <PublicBoardAuthContext.Provider value={mockAuth}>
      <div className="w-full">
        <CRMWithPermissions />
      </div>
    </PublicBoardAuthContext.Provider>
  );
};