import React from 'react';
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { BookingRequest } from '@/types/database';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from 'date-fns';
import { AlertCircle, Check, X, Trash2, FileText, PaperclipIcon, Paperclip } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { 
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell 
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStorageUrl } from "@/integrations/supabase/client";
import { FileDisplay } from "@/components/shared/FileDisplay";
import type { FileRecord } from "@/types/files";
import { getCurrencySymbol } from "@/lib/currency";

interface BookingRequestsListProps {
  requests: BookingRequest[];
  type: 'pending' | 'approved' | 'rejected';
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete: (id: string) => void;
}

export const BookingRequestsList = ({ 
  requests, 
  type,
  onApprove, 
  onReject,
  onDelete 
}: BookingRequestsListProps) => {
  const { t, language } = useLanguage();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const isGeorgian = language === 'ka';
  const isMobile = useMediaQuery('(max-width: 640px)');
  const currencySymbol = getCurrencySymbol(language);

  const handleDeleteClick = (id: string) => {
    setRequestToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (requestToDelete) {
      onDelete(requestToDelete);
      setIsDeleteConfirmOpen(false);
      setRequestToDelete(null);
    }
  };
  
  const handleApprove = async (id: string) => {
    // Log the current language context
    console.log(`Approving request ${id} with UI language: ${language}`);
    
    // Check if the request has its own language setting
    const requestToApprove = requests.find(req => req.id === id);
    if (requestToApprove) {
      console.log(`Request ${id} language setting: ${requestToApprove.language || 'not set'}`);
    }
    
    // Set processing state to show loading indicator
    setProcessingId(id);
    try {
      await onApprove?.(id);
    } finally {
      // Clear processing state when done (success or error)
      setProcessingId(null);
    }
  };
  
  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await onReject?.(id);
    } finally {
      setProcessingId(null);
    }
  };

  // Improved function to deduplicate files
  const mapRequestFilesToFileRecords = (request: BookingRequest): FileRecord[] => {
    const files: FileRecord[] = [];
    const fileSignatures = new Set<string>(); // Track file signatures to prevent duplicates
    
    // Helper function to add a file if it's not a duplicate
    const addUniqueFile = (file: FileRecord) => {
      // Create a unique signature for the file based on path and name
      const signature = `${file.filename}:${file.file_path}`;
      
      if (!fileSignatures.has(signature)) {
        fileSignatures.add(signature);
        files.push(file);
      }
    };
    
    // Add direct file if it exists on the request
    if (request.file_path) {
      addUniqueFile({
        id: `${request.id}-main`,
        filename: request.filename || 'file',
        file_path: request.file_path,
        content_type: request.content_type || '',
        size: request.size || 0,
        created_at: request.created_at,
        user_id: request.user_id || null,
        event_id: request.id
      });
    }
    
    // Add any files from the files array with deduplication
    if (request.files && request.files.length > 0) {
      request.files.forEach(file => {
        addUniqueFile({
          id: file.id,
          filename: file.filename,
          file_path: file.file_path,
          content_type: file.content_type || '',
          size: file.size || 0,
          created_at: request.created_at,
          user_id: request.user_id || null,
          event_id: request.id
        });
      });
    }
    
    return files;
  };

  // Format payment status for display with proper styling
  const renderPaymentStatus = (status?: string, amount?: number | null) => {
    let statusDisplay: React.ReactNode;
    
    if (!status || status === 'not_paid') {
      // Red for not paid
      statusDisplay = (
        <Badge variant="outline" className="text-[#ea384c] border-[#ea384c] bg-transparent">
          {language === 'en' ? 'Not Paid' : 
           language === 'es' ? 'No Pagado' : 
           <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText>}
        </Badge>
      );
    } else if (status === 'partly_paid' || status === 'partly') {
      // Orange for partly paid
      let text = language === 'en' ? 'Partly Paid' : 
                 language === 'es' ? 'Pagado Parcialmente' : 
                 <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText>;
      
      if (amount) {
        text = (
          <>
            {text} <span className="ml-1">({currencySymbol}{amount})</span>
          </>
        );
      }
      
      statusDisplay = (
        <Badge variant="outline" className="text-[#F97316] border-[#F97316] bg-transparent">
          {text}
        </Badge>
      );
    } else if (status === 'fully_paid' || status === 'fully') {
      // Green for fully paid
      let text = language === 'en' ? 'Fully Paid' : 
                 language === 'es' ? 'Pagado Completamente' : 
                 <GeorgianAuthText>სრულად გადახდილი</GeorgianAuthText>;
      
      if (amount) {
        text = (
          <>
            {text} <span className="ml-1">({currencySymbol}{amount})</span>
          </>
        );
      }
      
      statusDisplay = (
        <Badge variant="outline" className="text-[#10b981] border-[#10b981] bg-transparent">
          {text}
        </Badge>
      );
    } else {
      // Default case
      statusDisplay = (
        <Badge variant="outline">
          {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
        </Badge>
      );
    }
    
    return statusDisplay;
  };

  // Helper to render Georgian text properly
  const renderGeorgianText = (key: string) => {
    if (isGeorgian) {
      if (key === "business.pendingRequests") return <GeorgianAuthText>მოთხოვნები მოლოდინში</GeorgianAuthText>;
      if (key === "business.approvedRequests") return <GeorgianAuthText>დადასტურებული მოთხოვნები</GeorgianAuthText>;
      if (key === "business.rejectedRequests") return <GeorgianAuthText>უარყოფილი მოთხოვნები</GeorgianAuthText>;
      if (key === "business.customer") return <GeorgianAuthText>მომხმარებელი</GeorgianAuthText>;
      if (key === "business.paymentStatus") return <GeorgianAuthText>გადახდის სტატუსი</GeorgianAuthText>;
      if (key === "business.dateTime") return <GeorgianAuthText>თარიღი და დრო</GeorgianAuthText>;
      if (key === "business.actions") return <GeorgianAuthText>მოქმედებები</GeorgianAuthText>;
      if (key === "business.approve") return <GeorgianAuthText>დადასტურება</GeorgianAuthText>;
      if (key === "business.reject") return <GeorgianAuthText>უარყოფა</GeorgianAuthText>;
      if (key === "business.delete") return <GeorgianAuthText>წაშლა</GeorgianAuthText>;
      if (key === "business.comments") return <GeorgianAuthText>კომენტარები</GeorgianAuthText>;
      if (key === "business.attachments") return <GeorgianAuthText>დანართები</GeorgianAuthText>;
    }
    
    // For English and Spanish
    if (key === "business.paymentStatus") {
      if (language === 'en') return "Payment Status";
      if (language === 'es') return "Estado del pago";
    }
    
    if (key === "business.comments") {
      if (language === 'en') return "Comments";
      if (language === 'es') return "Comentarios";
    }
    
    if (key === "business.attachments") {
      if (language === 'en') return "Attachments";
      if (language === 'es') return "Archivos adjuntos";
    }
    
    return <LanguageText>{t(key)}</LanguageText>;
  };

  if (requests.length === 0) {
    return (
      <div className="text-center p-10 border border-dashed rounded-lg">
        <div className="flex justify-center mb-4">
          {type === 'pending' && (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground border-dashed"></div>
            </div>
          )}
          {type === 'approved' && (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Check className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          {type === 'rejected' && (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <X className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <h3 className="text-lg font-medium">
          <LanguageText>
            {type === 'pending' ? t("business.noPendingRequests") : 
             type === 'approved' ? t("business.noApprovedRequests") : 
             t("business.noRejectedRequests")}
          </LanguageText>
        </h3>
        <p className="text-muted-foreground mt-2">
          <LanguageText>
            {type === 'pending' ? t("business.pendingRequestsDescription") : 
             type === 'approved' ? t("business.approvedRequestsDescription") : 
             t("business.rejectedRequestsDescription")}
          </LanguageText>
        </p>
      </div>
    );
  }

  // Responsive table view with improved mobile styling
  return (
    <>
      <div className="rounded-md border">
        {/* Make the container scrollable horizontally on mobile */}
        <div className="overflow-x-auto w-full">
          <Table className="min-w-[750px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-1/6">{renderGeorgianText("business.customer")}</TableHead>
                <TableHead className="w-1/6">{renderGeorgianText("business.paymentStatus")}</TableHead>
                <TableHead className="w-1/6">{renderGeorgianText("business.dateTime")}</TableHead>
                <TableHead className="w-1/6">{renderGeorgianText("business.comments")}</TableHead>
                <TableHead className="w-1/6">{renderGeorgianText("business.attachments")}</TableHead>
                <TableHead className="w-1/6 text-right">{renderGeorgianText("business.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id} className="h-[72px]">
                  <TableCell className="font-medium py-2">
                    <div className="overflow-hidden">
                      <div className="font-medium truncate">{request.requester_name}</div>
                      <div className="text-sm text-muted-foreground truncate">{request.requester_email || request.requester_phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {renderPaymentStatus(request.payment_status, request.payment_amount)}
                  </TableCell>
                  <TableCell className="text-sm py-2">
                    {request.start_date && (
                      <>
                        {formatDate(new Date(request.start_date), 'MMM d, yyyy')}
                        <br />
                        {formatDate(new Date(request.start_date), 'h:mm a')} - {request.end_date ? formatDate(new Date(request.end_date), 'h:mm a') : ''}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {request.description ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="max-w-[150px] truncate cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                              {request.description}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="whitespace-normal">{request.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {(request.file_path || (request.files && request.files.length > 0)) ? (
                      <FileDisplay 
                        files={mapRequestFilesToFileRecords(request)}
                        bucketName="booking_attachments"
                        allowDelete={false}
                        parentType="event"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {/* Improve action buttons layout - stack on mobile */}
                    <div className="flex flex-wrap gap-2 justify-end sm:justify-end">
                      {type === 'pending' && onApprove && (
                        <Button 
                          variant="approve" 
                          size="sm" 
                          className="flex gap-1 items-center w-full sm:w-auto" 
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          <span>
                            {processingId === request.id ? (
                              <LanguageText>{t("common.processing")}</LanguageText>
                            ) : (
                              renderGeorgianText("business.approve")
                            )}
                          </span>
                        </Button>
                      )}
                      {type === 'pending' && onReject && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex gap-1 items-center hover:bg-red-100 hover:text-red-700 hover:border-red-300 w-full sm:w-auto" 
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                          <span>
                            {processingId === request.id ? (
                              <LanguageText>{t("common.processing")}</LanguageText>
                            ) : (
                              renderGeorgianText("business.reject")
                            )}
                          </span>
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive flex gap-1 items-center hover:bg-destructive/10 w-full sm:w-auto" 
                        onClick={() => handleDeleteClick(request.id)}
                        disabled={processingId === request.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>
                          {renderGeorgianText("business.delete")}
                        </span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <LanguageText>{t("business.deleteBookingRequest")}</LanguageText>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <LanguageText>{t("common.deleteConfirmMessage")}</LanguageText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><LanguageText>{t("common.cancel")}</LanguageText></AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <LanguageText>{t("common.delete")}</LanguageText>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
