
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { getCurrencySymbol } from "@/lib/currency";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { FileRecord } from "@/types/files";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BookingRequest {
  id: string;
  title: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  start_date: string;
  end_date: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_status?: string;
  payment_amount?: number;
  language?: string;
  created_at: string;
}

interface BookingRequestsListProps {
  requests: BookingRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  isApprovingBooking: boolean;
  isRejectingBooking: boolean;
  isDeletingBooking: boolean;
  showActions?: boolean;
}

// Hook to fetch booking request files
const useBookingRequestFiles = (bookingId: string) => {
  return useQuery({
    queryKey: ['booking-request-files', bookingId],
    queryFn: async () => {
      console.log('Fetching files for booking request:', bookingId);
      
      // First try to get files from event_files table (since approved bookings use same ID)
      const { data: eventFiles, error: eventFilesError } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', bookingId);

      if (eventFilesError) {
        console.error('Error fetching event files:', eventFilesError);
      }

      // Also check if there are files directly in booking_requests table
      const { data: bookingData, error: bookingError } = await supabase
        .from('booking_requests')
        .select('file_path, filename, content_type, size')
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        console.error('Error fetching booking data:', bookingError);
      }

      const allFiles: FileRecord[] = [];

      // Add files from event_files table
      if (eventFiles && eventFiles.length > 0) {
        eventFiles.forEach(file => {
          allFiles.push({
            id: file.id,
            filename: file.filename,
            file_path: file.file_path,
            content_type: file.content_type,
            size: file.size,
            created_at: file.created_at,
            user_id: file.user_id,
            source: 'event'
          });
        });
      }

      // Add file from booking_requests table if it exists
      if (bookingData?.file_path && bookingData.filename) {
        allFiles.push({
          id: `booking-${bookingId}`,
          filename: bookingData.filename,
          file_path: bookingData.file_path,
          content_type: bookingData.content_type || 'application/octet-stream',
          size: bookingData.size || 0,
          created_at: new Date().toISOString(),
          user_id: '',
          source: 'booking_request'
        });
      }

      console.log('Found files for booking request:', allFiles.length);
      return allFiles;
    },
    enabled: !!bookingId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

const BookingRequestRow: React.FC<{
  request: BookingRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  isApprovingBooking: boolean;
  isRejectingBooking: boolean;
  isDeletingBooking: boolean;
  showActions: boolean;
  isGeorgian: boolean;
  currencySymbol: string;
}> = ({
  request,
  onApprove,
  onReject,
  onDelete,
  isApprovingBooking,
  isRejectingBooking,
  isDeletingBooking,
  showActions,
  isGeorgian,
  currencySymbol
}) => {
  const { data: files = [] } = useBookingRequestFiles(request.id);

  return (
    <tr key={request.id} className="border-b">
      <td className="px-4 py-4">
        <div>
          <div className="font-medium">{request.requester_name}</div>
          <div className="text-sm text-muted-foreground">{request.requester_email}</div>
        </div>
      </td>
      <td className="px-4 py-4">
        {request.payment_status && (
          <Badge
            variant={
              request.payment_status === 'fully_paid'
                ? 'default'
                : request.payment_status === 'partly_paid'
                ? 'secondary'
                : 'outline'
            }
            className={cn(
              request.payment_status === 'fully_paid' && 'bg-green-600 hover:bg-green-700',
              request.payment_status === 'partly_paid' && 'bg-orange-600 hover:bg-orange-700 text-white',
              isGeorgian && "font-georgian"
            )}
          >
            {request.payment_status === 'fully_paid' && (
              isGeorgian ? <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText> : 'Fully Paid'
            )}
            {request.payment_status === 'partly_paid' && (
              <>
                {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : 'Partly Paid'}
                {request.payment_amount && (
                  <span className="ml-1">
                    ({currencySymbol}{request.payment_amount})
                  </span>
                )}
              </>
            )}
            {request.payment_status === 'not_paid' && (
              isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : 'Not Paid'
            )}
          </Badge>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="text-sm">
          {format(new Date(request.start_date), "MMM d, yyyy")}
          <br />
          <span className="text-muted-foreground">
            {format(new Date(request.start_date), "h:mm a")} - {format(new Date(request.end_date), "h:mm a")}
          </span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {request.description || '-'}
        </div>
      </td>
      <td className="px-4 py-4">
        {files.length > 0 ? (
          <FileDisplay 
            files={files}
            bucketName={files[0]?.source === 'booking_request' ? 'booking_attachments' : 'event_attachments'}
            allowDelete={false}
            parentType="booking"
            maxDisplayCount={1}
            showDownloadOnly={true}
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      {showActions && (
        <td className="px-4 py-4">
          <div className="flex gap-2">
            {request.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  onClick={() => onApprove(request.id)}
                  disabled={isApprovingBooking}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isGeorgian ? <GeorgianAuthText>დამტკიცება</GeorgianAuthText> : <LanguageText>Approve</LanguageText>}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onReject(request.id)}
                  disabled={isRejectingBooking}
                >
                  <X className="h-4 w-4 mr-1" />
                  {isGeorgian ? <GeorgianAuthText>უარყოფა</GeorgianAuthText> : <LanguageText>Reject</LanguageText>}
                </Button>
              </>
            )}
            {request.status === 'approved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(request.id)}
                disabled={isDeletingBooking}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
};

export const BookingRequestsList: React.FC<BookingRequestsListProps> = ({
  requests,
  onApprove,
  onReject,
  onDelete,
  isApprovingBooking,
  isRejectingBooking,
  isDeletingBooking,
  showActions = true,
}) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const
  } : undefined;

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="w-16 h-16 mx-auto mb-4 opacity-50">
          <div className="w-full h-full border-2 border-dashed border-current rounded-lg flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-dotted border-current rounded-full"></div>
          </div>
        </div>
        <p>{isGeorgian ? <GeorgianAuthText>მოთხოვნები არ არის</GeorgianAuthText> : "No pending requests"}</p>
        <p className="text-sm mt-1">
          {isGeorgian ? 
            <GeorgianAuthText>როდესაც მომხმარებლები წარადგენენ ჯავშნის მოთხოვნებს, ისინი აქ გამოჩნდებიან თქვენი დამტკიცებისთვის.</GeorgianAuthText> : 
            "When users submit booking requests, they will appear here for your approval."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>მომხმარებელი</GeorgianAuthText> : <LanguageText>{t("crm.customer")}</LanguageText>}
            </th>
            <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText> : <LanguageText>{t("events.paymentStatus")}</LanguageText>}
            </th>
            <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>თარიღი და დრო</GeorgianAuthText> : <LanguageText>{t("events.dateAndTime")}</LanguageText>}
            </th>
            <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>კომენტარები</GeorgianAuthText> : <LanguageText>{t("crm.comments")}</LanguageText>}
            </th>
            <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>დანართები</GeorgianAuthText> : <LanguageText>{t("common.attachments")}</LanguageText>}
            </th>
            {showActions && (
              <th className={cn("text-left px-4 py-3", isGeorgian && "font-georgian")} style={georgianStyle}>
                {isGeorgian ? <GeorgianAuthText>მოქმედებები</GeorgianAuthText> : <LanguageText>{t("crm.actions")}</LanguageText>}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <BookingRequestRow
              key={request.id}
              request={request}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
              isApprovingBooking={isApprovingBooking}
              isRejectingBooking={isRejectingBooking}
              isDeletingBooking={isDeletingBooking}
              showActions={showActions}
              isGeorgian={isGeorgian}
              currencySymbol={currencySymbol}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
