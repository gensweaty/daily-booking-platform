import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";
import { LoaderCircle } from "lucide-react";
import { WorkingHoursConfig } from "@/types/workingHours";

export const EmbedBookingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("accessing_public_business_page", "true");
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setError("No business specified");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id, working_hours")
        .ilike("slug", slug)
        .maybeSingle();
      if (error || !data) {
        setError("Business not found");
      } else {
        setBusinessId(data.id);
        setWorkingHours((data.working_hours as WorkingHoursConfig) || null);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !businessId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">{error || "Business not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <ExternalCalendar businessId={businessId} workingHours={workingHours} />
    </div>
  );
};

export default EmbedBookingPage;