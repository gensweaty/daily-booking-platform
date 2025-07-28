
import React from "react";
import { Clock, RefreshCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventMetadataProps {
  createdAt: string;
  updatedAt?: string;
}

export const EventMetadata = ({ createdAt, updatedAt }: EventMetadataProps) => {
  const { t, language } = useLanguage();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(language);
  };

  return (
    <div className="flex items-center text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center mr-6">
        <Clock className="mr-2 h-4 w-4" />
        <span className="font-medium">{t("events.createdAtLabel")}</span>
        <span className="ml-2">{formatDate(createdAt)}</span>
      </div>
      <div className="flex items-center">
        <RefreshCcw className="mr-2 h-4 w-4" />
        <span className="font-medium">{t("events.lastUpdatedLabel")}</span>
        <span className="ml-2">{formatDate(updatedAt || createdAt)}</span>
      </div>
    </div>
  );
};
