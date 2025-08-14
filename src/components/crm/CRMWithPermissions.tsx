import { PermissionGate } from "@/components/PermissionGate";
import CustomerList from "./CustomerList";

export const CRMWithPermissions = () => {
  return (
    <PermissionGate requiredPermission="crm">
      <CustomerList />
    </PermissionGate>
  );
};