import React from "react";
import { Calendar } from "../Calendar/Calendar";
import { AuthOverrideProvider } from "../PublicAuthProvider";

interface PublicCalendarWithPermissionsProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
}

export const PublicCalendarWithPermissions = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail 
}: PublicCalendarWithPermissionsProps) => {
  return (
    <AuthOverrideProvider userId={boardUserId}>
      <Calendar 
        defaultView="month"
        isPublicMode={true}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
      />
    </AuthOverrideProvider>
  );
};