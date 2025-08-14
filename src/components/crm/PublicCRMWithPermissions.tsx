import React from "react";
import { CustomerList } from "./CustomerList";
import { AuthOverrideProvider } from "../PublicAuthProvider";

interface PublicCRMWithPermissionsProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
}

export const PublicCRMWithPermissions = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail 
}: PublicCRMWithPermissionsProps) => {
  return (
    <AuthOverrideProvider userId={boardUserId}>
      <CustomerList 
        isPublicMode={true}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
      />
    </AuthOverrideProvider>
  );
};