
import { useEffect, useState } from "react";
import { Calendar } from "@/components/Calendar/Calendar";
import { BookingRequests } from "@/components/business/BookingRequests";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export const DashboardContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!user && isMounted) {
      navigate("/signin");
    }
  }, [user, navigate, isMounted]);

  if (!user) {
    return null;
  }

  const handleBookingRequestApproved = () => {
    toast.event.bookingSubmitted();
  };

  return (
    <div className={`flex flex-col h-full ${isMobile ? 'gap-2 -mx-4' : 'gap-4'}`}>
      <h1 className="scroll-m-20 text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        <div className="lg:w-3/5 flex-1">
          <Calendar />
        </div>
        <div className="lg:w-2/5 flex-1">
          <BookingRequests onBookingRequestApproved={handleBookingRequestApproved} />
        </div>
      </div>
    </div>
  );
};
