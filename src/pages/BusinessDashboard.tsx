
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { BusinessButton } from "@/components/business/BusinessButton";
import { BusinessDialog, BusinessData } from "@/components/business/BusinessDialog";
import { BusinessCard } from "@/components/business/BusinessCard";
import { UnconfirmedEventsList } from "@/components/business/UnconfirmedEventsList";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export const BusinessDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshEvents, setRefreshEvents] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/signin");
      return;
    }

    const fetchBusiness = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setBusiness(data);
      } catch (error: any) {
        console.error("Error fetching business:", error);
        toast({
          title: t("business.error"),
          description: t("business.errorLoadingBusiness"),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusiness();
  }, [user, navigate, toast, t]);

  const handleBusinessCreated = (newBusiness: BusinessData) => {
    setBusiness(newBusiness);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <BusinessButton
        onAddClick={() => setIsDialogOpen(true)}
        hasExistingBusiness={!!business}
      />

      {business ? (
        <div className="grid grid-cols-1 gap-6">
          <BusinessCard business={business} onEdit={() => setIsDialogOpen(true)} />
          
          <UnconfirmedEventsList 
            businessId={business.id} 
            onEventApproved={() => setRefreshEvents(prev => prev + 1)}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <h2 className="text-xl font-semibold mb-2">{t("business.noBusiness")}</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            {t("business.addBusinessPrompt")}
          </p>
        </div>
      )}

      <BusinessDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onBusinessCreated={handleBusinessCreated}
        existingBusiness={business || undefined}
      />
    </div>
  );
};
