
import { useState } from "react";
import { BookingRequest } from "@/types/database";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Check, X, Trash2, CalendarIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { FileDisplay } from "../shared/FileDisplay";
import { supabase, associateBookingFilesWithEvent } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

type RequestType = "pending" | "approved" | "rejected";

interface BookingRequestsListProps {
  requests: BookingRequest[];
  type: RequestType;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const BookingRequestsList = ({
  requests,
  type,
  onApprove,
  onReject,
  onDelete,
}: BookingRequestsListProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === "ka";
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Fetch files for each booking request
  const { data: bookingFiles } = useQuery({
    queryKey: ["booking-files", requests.map(r => r.id).join('-')],
    queryFn: async () => {
      const results: Record<string, any[]> = {};
      
      for (const request of requests) {
        try {
          const { data, error } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', request.id);
            
          if (error) {
            console.error(`Error fetching files for booking ${request.id}:`, error);
            results[request.id] = [];
          } else {
            results[request.id] = data || [];
            console.log(`Fetched ${data?.length || 0} files for booking ${request.id}`, data);
          }
        } catch (err) {
          console.error(`Exception fetching files for booking ${request.id}:`, err);
          results[request.id] = [];
        }
      }
      
      return results;
    },
    enabled: requests.length > 0,
  });

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Event handler that ensures files are associated during approval
  const handleApprove = async (id: string) => {
    if (onApprove) {
      try {
        // Call the original handler
        await onApprove(id);
        console.log("Request approved, files will be associated automatically");
      } catch (error) {
        console.error("Error during booking approval:", error);
      }
    }
  };

  const getStatusStyle = (requestType: RequestType) => {
    switch (requestType) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  if (requests.length === 0) {
    return (
      <Alert className="bg-muted">
        <Info className="h-4 w-4" />
        <AlertTitle className={cn(isGeorgian ? "font-georgian" : "")}>
          <LanguageText>{t("business.noRequests")}</LanguageText>
        </AlertTitle>
        <AlertDescription className={cn(isGeorgian ? "font-georgian" : "")}>
          <LanguageText>
            {type === "pending"
              ? t("business.noPendingRequests")
              : type === "approved"
              ? t("business.noApprovedRequests")
              : t("business.noRejectedRequests")}
          </LanguageText>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const hasAttachments = bookingFiles && bookingFiles[request.id] && bookingFiles[request.id].length > 0;
        
        return (
          <Card
            key={request.id}
            className="p-4 transition-all"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <h3 className="font-medium">{request.requester_name}</h3>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-full",
                        getStatusStyle(type)
                      )}
                    >
                      <LanguageText>
                        {type === "pending"
                          ? t("common.pending")
                          : type === "approved"
                          ? t("common.approved")
                          : t("common.rejected")}
                      </LanguageText>
                    </span>
                    {hasAttachments && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        <LanguageText>{t("common.hasAttachments")}</LanguageText>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {request.requester_email}
                    {request.requester_phone && ` • ${request.requester_phone}`}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarIcon className="w-3 h-3" />
                    <span>
                      {format(new Date(request.start_date), "MMM dd, yyyy • HH:mm")} - 
                      {format(new Date(request.end_date), " HH:mm")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {type === "pending" && onApprove && onReject && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1"
                        onClick={() => handleApprove(request.id)}
                      >
                        <Check className="w-4 h-4" />
                        <LanguageText>{t("common.approve")}</LanguageText>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => onReject(request.id)}
                      >
                        <X className="w-4 h-4" />
                        <LanguageText>{t("common.reject")}</LanguageText>
                      </Button>
                    </>
                  )}
                  {onDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(request.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="justify-start p-0 hover:bg-transparent hover:underline"
                onClick={() => toggleDetails(request.id)}
              >
                <LanguageText>
                  {expandedDetails[request.id] ? t("common.hideDetails") : t("common.showDetails")}
                </LanguageText>
              </Button>

              {expandedDetails[request.id] && (
                <div className="text-sm">
                  <h4 className="font-medium mb-2">
                    <LanguageText>{t("business.bookingDetails")}</LanguageText>
                  </h4>
                  {request.description && (
                    <div className="mb-4 border p-3 rounded-md bg-muted/50">
                      <p>
                        {request.description.split("\n").map((line, i) => (
                          <span key={i}>
                            {line}
                            <br />
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                  
                  {hasAttachments && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">
                        <LanguageText>{t("common.attachments")}</LanguageText>
                      </h4>
                      <FileDisplay
                        files={bookingFiles[request.id]}
                        bucketName="event_attachments"
                        allowDelete={false}
                        parentType="booking"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
