import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo } from "react";

interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  customerId?: string;
  createEvent: boolean;
  setCreateEvent: (value: boolean) => void;
  isEventData: boolean;
}

export const CustomerDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  customerId,
  createEvent,
  setCreateEvent,
  isEventData,
}: CustomerDialogFieldsProps) => {
  
  const { data: fetchedFiles = [], isError } = useQuery({
    queryKey: ['customerFiles', customerId, isEventData],
    queryFn: async () => {
      if (!customerId) return [];
      
      console.log('Fetching files for customer:', customerId, 'isEventData:', isEventData);
      
      try {
        let files = [];
        
        if (isEventData) {
          // Get files from event_files
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', customerId);
            
          if (eventFilesError) {
            console.error('Error fetching event files:', eventFilesError);
          } else {
            files = [...files, ...(eventFiles || [])];
          }
        } else {
          // Get files from customer_files_new
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', customerId);
            
          if (customerFilesError) {
            console.error('Error fetching customer files:', customerFilesError);
          } else {
            files = [...files, ...(customerFiles || [])];
          }
        }
        
        console.log('Found files:', files);
        return files;
      } catch (error) {
        console.error('Error in file fetching:', error);
        return [];
      }
    },
    enabled: !!customerId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1
  });

  // Memoize the files array to prevent unnecessary re-renders
  const allFiles = useMemo(() => fetchedFiles, [fetchedFiles]);

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-1">
          <Label htmlFor="title">Full Name (required)</Label>
          <Input
            id="title"
            placeholder="Full name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="number">Phone Number</Label>
          <Input
            id="number"
            type="tel"
            placeholder="Phone number"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="socialNetwork">Social Link or Email</Label>
        <Input
          id="socialNetwork"
          type="text"
          placeholder="Social link or email"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="createEvent"
          checked={createEvent}
          onCheckedChange={(checked) => setCreateEvent(checked as boolean)}
        />
        <Label htmlFor="createEvent">Create event for this customer</Label>
      </div>

      {createEvent && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required={createEvent}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required={createEvent}
              className="w-full"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-1">
          <Label>Payment Status</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger className="w-full bg-background border-input">
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-input shadow-md">
              <SelectItem value="not_paid" className="hover:bg-muted focus:bg-muted">Not paid</SelectItem>
              <SelectItem value="partly" className="hover:bg-muted focus:bg-muted">Paid Partly</SelectItem>
              <SelectItem value="fully" className="hover:bg-muted focus:bg-muted">Paid Fully</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentStatus && paymentStatus !== 'not_paid' && (
          <div className="space-y-1">
            <Label htmlFor="amount">Payment Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="Enter amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              className="w-full"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Comment</Label>
        <Textarea
          id="notes"
          placeholder="Add a comment about the customer"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      {customerId && allFiles && allFiles.length > 0 && (
        <div className="space-y-1">
          <Label>Attachments</Label>
          <FileDisplay 
            files={allFiles} 
            bucketName="customer_attachments"
            allowDelete
          />
        </div>
      )}

      <FileUploadField 
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
      />
    </div>
  );
};