
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";

interface EventMetadataProps {
  createdAt: string;
  updatedAt?: string;
}

export const EventMetadata = ({ createdAt, updatedAt }: EventMetadataProps) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy 'at' HH:mm");
  };

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  return (
    <div className="flex items-center gap-4 px-2 py-1.5 rounded-md border border-muted/30 bg-muted/20 w-fit">
      <div className="flex items-center gap-1">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span 
          className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          {isGeorgian ? (
            <GeorgianAuthText letterSpacing="-0.05px">
              {t("events.createdAtLabel")}
            </GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.createdAtLabel")}</LanguageText>
          )}
        </span>
        <span className="text-xs text-foreground">
          {formatDate(createdAt)}
        </span>
      </div>
      
      <div className="flex items-center gap-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span 
          className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}
          style={georgianStyle}
        >
          {isGeorgian ? (
            <GeorgianAuthText letterSpacing="-0.05px">
              {t("events.lastUpdatedLabel")}
            </GeorgianAuthText>
          ) : (
            <LanguageText>{t("events.lastUpdatedLabel")}</LanguageText>
          )}
        </span>
        <span className="text-xs text-foreground">
          {formatDate(updatedAt || createdAt)}
        </span>
      </div>
    </div>
  );
};
