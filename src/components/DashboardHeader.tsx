
import { Link } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/useSignOut";
import { useNavigate } from "react-router-dom";
import { BookingRequestNotifications } from "./business/BookingRequestNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Using default export instead of named export
const DashboardHeader = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  
  // Fetch business profile for current user
  const { data: businessProfile } = useQuery({
    queryKey: ['businessProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  return (
    <div className="flex flex-col md:flex-row justify-between items-center pt-4 px-4 md:px-8 gap-4">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="text-2xl font-bold">
          Dashboard
        </Link>
        <nav className="hidden md:flex gap-2">
          <Link to="/dashboard" className="px-2 py-1 rounded hover:bg-accent">
            Home
          </Link>
          <Link to="/dashboard/calendar" className="px-2 py-1 rounded hover:bg-accent">
            Calendar
          </Link>
          <Link to="/dashboard/customers" className="px-2 py-1 rounded hover:bg-accent">
            CRM
          </Link>
          <Link to="/dashboard/booking-requests" className="px-2 py-1 rounded hover:bg-accent flex items-center">
            Booking Requests
            {businessProfile && <BookingRequestNotifications businessId={businessProfile.id} />}
          </Link>
          <Link to="/dashboard/statistics" className="px-2 py-1 rounded hover:bg-accent">
            Statistics
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "Avatar"} />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/dashboard/profile')}>
              <span className="mr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/pricing')}>
              <span className="mr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </span>
              Upgrade
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => signOut()}>
              <span className="mr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </span>
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default DashboardHeader;
