import { CustomerList } from "@/components/crm/CustomerList";

interface PublicCRMProps {
  boardUserId: string;
}

export const PublicCRM = ({ boardUserId }: PublicCRMProps) => {
  // Override the auth context for CRM to use the board user ID
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
      <CustomerList />
    </div>
  );
};