import { CRMWithPermissions } from "@/components/crm/CRMWithPermissions";
import { AuthOverrideProvider } from "./PublicAuthProvider";

interface PublicCRMProps {
  boardUserId: string;
}

export const PublicCRM = ({ boardUserId }: PublicCRMProps) => {
  return (
    <AuthOverrideProvider userId={boardUserId}>
      <CRMWithPermissions />
    </AuthOverrideProvider>
  );
};