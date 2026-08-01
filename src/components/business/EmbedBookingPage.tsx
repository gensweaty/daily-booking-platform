import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";
import { LoaderCircle, Clock } from "lucide-react";
import { WorkingHoursConfig, DAYS_OF_WEEK, DayOfWeek } from "@/types/workingHours";
import { useLanguage } from "@/contexts/LanguageContext";

export const EmbedBookingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [businessAvatar, setBusinessAvatar] = useState<string | null>(null);
  const [businessSlug, setBusinessSlug] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLanguage, t } = useLanguage();

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
        .select("id, user_id, business_name, avatar_url, slug, working_hours")
        .ilike("slug", slug)
        .maybeSingle();
      if (error || !data) {
        setError("Business not found");
      } else {
        setBusinessId(data.id);
        setBusinessUserId((data as { user_id?: string }).user_id || null);
        setBusinessName(data.business_name || "");
        setBusinessAvatar(data.avatar_url || null);
        setBusinessSlug(data.slug || slug);
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
      {workingHours?.enabled && (
        <div className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-2 grid grid-cols-4 items-center gap-x-1.5 gap-y-1.5 sm:flex sm:flex-wrap sm:gap-x-2">
          <span className="col-span-2 flex items-center gap-1.5 shrink-0">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-[12.5px] sm:text-xs font-medium text-foreground leading-tight">
              {t("business.workingHours") || "Working Hours"}:
            </span>
          </span>
          {DAYS_OF_WEEK.map((day) => {
              const cfg = workingHours.days?.[day as DayOfWeek];
              if (!cfg?.enabled) return null;
              const label = t(`calendar.days.${day}`) || day;
              const short = typeof label === "string" ? label.slice(0, 3) : day.slice(0, 3);
              return (
                <span
                  key={day}
                  className="min-w-0 flex flex-col items-center sm:flex-row sm:items-baseline text-[10.5px] sm:text-[11px] px-1 sm:px-2 py-0.5 rounded-md bg-background border border-border/60 whitespace-nowrap leading-tight"
                >
                  <span className="font-semibold text-foreground">{short}</span>
                  <span className="text-muted-foreground sm:ml-1 tabular-nums">{cfg.start}-{cfg.end}</span>
                </span>
              );
          })}
        </div>
      )}
      <div className="flex-1 p-2 sm:p-3">
        <ExternalCalendar
          businessId={businessId}
          workingHours={workingHours}
          initialBusinessUserId={businessUserId}
        />
      </div>
      {!hideBranding && (
        <div className="shrink-0 border-t border-border/60 py-2 px-3 flex items-center justify-between gap-3 text-xs text-muted-foreground bg-background/80">
          {businessName && businessSlug ? (
            <a
              href={`https://smartbookly.com/business/${businessSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 hover:text-primary transition-colors"
              title={businessName}
            >
              {businessAvatar ? (
                <img
                  src={businessAvatar}
                  alt={businessName}
                  className="h-5 w-5 rounded-full object-cover border border-border/60"
                  loading="lazy"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-primary/10 border border-border/60 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {businessName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-foreground truncate max-w-[180px]">
                {businessName}
              </span>
            </a>
          ) : (
            <span />
          )}
          <a
            href="https://smartbookly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors shrink-0"
          >
            Powered by <span className="font-semibold text-primary">Smartbookly</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default EmbedBookingPage;