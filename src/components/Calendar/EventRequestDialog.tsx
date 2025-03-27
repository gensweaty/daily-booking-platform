
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EventRequest } from "@/lib/types/business";
import { useEventRequests } from "@/hooks/useEventRequests";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface EventRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventRequest: EventRequest;
}

export const EventRequestDialog = ({ open, onOpenChange, eventRequest }: EventRequestDialogProps) => {
  const { t } = useLanguage();
  const { approveRequest, rejectRequest, isPending } = useEventRequests(eventRequest?.business_id);
  
  const handleApprove = async () => {
    await approveRequest(eventRequest.id);
    onOpenChange(false);
  };
  
  const handleReject = async () => {
    await rejectRequest(eventRequest.id);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Event Request: {eventRequest?.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Name</h4>
              <p className="text-sm">{eventRequest?.title}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Contact Name</h4>
              <p className="text-sm">{eventRequest?.user_surname || "N/A"}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Phone</h4>
              <p className="text-sm">{eventRequest?.user_number || "N/A"}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Social/Email</h4>
              <p className="text-sm">{eventRequest?.social_network_link || "N/A"}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Start Date</h4>
              <p className="text-sm">{format(new Date(eventRequest?.start_date), "PPP p")}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">End Date</h4>
              <p className="text-sm">{format(new Date(eventRequest?.end_date), "PPP p")}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Payment Status</h4>
              <p className="text-sm">{eventRequest?.payment_status || "Not Paid"}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-1">Payment Amount</h4>
              <p className="text-sm">{eventRequest?.payment_amount || "N/A"}</p>
            </div>
          </div>
          
          {eventRequest?.event_notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm whitespace-pre-wrap">{eventRequest.event_notes}</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button 
            type="button" 
            variant="destructive"
            onClick={handleReject}
            disabled={isPending}
          >
            Reject
          </Button>
          <Button 
            type="button"
            onClick={handleApprove}
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
