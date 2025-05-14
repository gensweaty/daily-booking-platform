
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBookingRequests } from '@/hooks/useBookingRequests';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface BookingRequestsProps {
  onBookingRequestApproved?: () => void;
}

export const BookingRequests: React.FC<BookingRequestsProps> = ({ onBookingRequestApproved }) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const { 
    pendingRequests,
    loading,
    approveRequest,
    rejectRequest
  } = useBookingRequests({
    isBusinessView: true
  });

  const handleApprove = async (id: string) => {
    const success = await approveRequest(id);
    if (success && onBookingRequestApproved) {
      onBookingRequestApproved();
    }
  };

  if (!user) return null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("business.pendingBookings")}</span>
          {pendingRequests.length > 0 && (
            <Badge variant="orange">{pendingRequests.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("common.loading")}...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("business.noBookingRequests")}
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium">{request.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {request.requester_name} - {request.requester_email}
                    </p>
                  </div>
                  <Badge>{request.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t("business.from")}:</span>{" "}
                    {formatDate(new Date(request.start_date))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("business.to")}:</span>{" "}
                    {formatDate(new Date(request.end_date))}
                  </div>
                </div>
                {request.description && (
                  <p className="text-sm mb-3 line-clamp-2">{request.description}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleApprove(request.id)}
                  >
                    <Check className="mr-1 h-4 w-4" /> {t("common.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => rejectRequest(request.id)}
                  >
                    <X className="mr-1 h-4 w-4" /> {t("common.reject")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
