import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";
import { LoaderCircle } from "lucide-react";
import { WorkingHoursConfig } from "@/types/workingHours";
import { useLanguage } from "@/contexts/LanguageContext";

export const EmbedBookingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLanguage } = useLanguage();

  const theme = useMemo(() => {
    const t = (searchParams.get("theme") || "light").toLowerCase();
    return t === "dark" ? "dark" : "light";
  }, [searchParams]);
  const lang = useMemo(() => {
    const l = (searchParams.get("lang") || "en").toLowerCase();
    return ["en", "es", "ka"].includes(l) ? (l as "en" | "es" | "ka") : "en";
  }, [searchParams]);
  const hideBranding = searchParams.get("branding") === "0";

  useEffect(() => {
    localStorage.setItem("accessing_public_business_page", "true");
  }, []);

  // Apply theme to <html> for the embed page
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
  }, [theme]);

  // Apply requested language
  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);

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
        setWorkingHours((data.working_hours as unknown as WorkingHoursConfig) || null);
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
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 p-2 sm:p-3">
        <ExternalCalendar businessId={businessId} workingHours={workingHours} />
      </div>
      {!hideBranding && (
        <div className="shrink-0 border-t border-border/60 py-2 px-3 flex items-center justify-center text-xs text-muted-foreground bg-background/80">
          <a
            href="https://smartbookly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Powered by <span className="font-semibold text-primary">Smartbookly</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default EmbedBookingPage;