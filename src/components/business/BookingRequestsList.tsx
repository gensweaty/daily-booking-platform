
import React from 'react';
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { BookingRequest } from '@/types/database';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from 'date-fns';
import { AlertCircle, Check, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Badge } from "@/components/ui/badge";

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
  const isGeorgian = language === 'ka';

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
            {text} <span className="ml-1">(${amount})</span>
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
            {text} <span className="ml-1">(${amount})</span>
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
    }
    
    // For English and Spanish, handle "Payment Status" explicitly
    if (key === "business.paymentStatus") {
      if (language === 'en') return "Payment Status";
      if (language === 'es') return "Estado del pago";
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

  return (
    <>
      <div className="rounded-md border">
        <div className="bg-muted/50 p-4 grid grid-cols-4 font-medium">
          <div>{renderGeorgianText("business.customer")}</div>
          <div>{renderGeorgianText("business.paymentStatus")}</div>
          <div>{renderGeorgianText("business.dateTime")}</div>
          <div className="text-right">{renderGeorgianText("business.actions")}</div>
        </div>
        <div className="divide-y">
          {requests.map((request) => (
            <div key={request.id} className="p-4 grid grid-cols-4 items-center">
              <div className="overflow-hidden">
                <div className="font-medium truncate">{request.requester_name}</div>
                <div className="text-sm text-muted-foreground truncate">{request.requester_email || request.requester_phone}</div>
              </div>
              <div className="truncate pr-4">
                {renderPaymentStatus(request.payment_status, request.payment_amount)}
              </div>
              <div className="text-sm">
                {request.start_date && (
                  <>
                    {formatDate(new Date(request.start_date), 'MMM d, yyyy')}
                    <br />
                    {formatDate(new Date(request.start_date), 'h:mm a')} - {request.end_date ? formatDate(new Date(request.end_date), 'h:mm a') : ''}
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {type === 'pending' && onApprove && (
                  <Button 
                    variant="approve" 
                    size="sm" 
                    className="flex gap-1 items-center" 
                    onClick={() => onApprove(request.id)}
                  >
                    <Check className="h-4 w-4" />
                    <span>{renderGeorgianText("business.approve")}</span>
                  </Button>
                )}
                {type === 'pending' && onReject && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex gap-1 items-center hover:bg-red-100 hover:text-red-700 hover:border-red-300" 
                    onClick={() => onReject(request.id)}
                  >
                    <X className="h-4 w-4 text-red-600" />
                    <span>{renderGeorgianText("business.reject")}</span>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive flex gap-1 items-center hover:bg-destructive/10" 
                  onClick={() => handleDeleteClick(request.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{renderGeorgianText("business.delete")}</span>
                </Button>
              </div>
            </div>
          ))}
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
