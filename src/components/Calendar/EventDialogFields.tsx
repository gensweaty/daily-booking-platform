import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface EventDialogFieldsProps {
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
  eventId?: string;
  onFileDeleted?: (fileId: string) => void;
}

export const EventDialogFields = ({
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
  eventId,
  onFileDeleted,
}: EventDialogFieldsProps) => {
  const queryClient = useQueryClient();
  
  const { data: allFiles = [] } = useQuery({
    queryKey: ['eventFiles', eventId, title],
    queryFn: async () => {
      if (!eventId && !title) return [];
      
      try {
        const uniqueFiles = new Map();

        // First try to get event files if we have an eventId
        if (eventId) {
          const { data: eventFiles, error: eventFilesError } = await supabase
            .from('event_files')
            .select('*')
            .eq('event_id', eventId);
          
          if (eventFilesError) throw eventFilesError;

          eventFiles?.forEach(file => {
            uniqueFiles.set(file.file_path, {
              ...file,
              source: 'event'
            });
          });
        }

        // Then try to get customer files if we have a title
        if (title) {
          const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(`
              id,
              customer_files_new (*)
            `)
            .eq('title', title)
            .maybeSingle();

          if (!customerError && customer?.customer_files_new) {
            customer.customer_files_new.forEach(file => {
              if (!uniqueFiles.has(file.file_path)) {
                uniqueFiles.set(file.file_path, {
                  ...file,
                  source: 'customer'
                });
              }
            });
          }
        }

        const files = Array.from(uniqueFiles.values());
        console.log('Final files:', files);
        return files;
      } catch (error) {
        console.error('Error in file fetching:', error);
        return [];
      }
    },
    enabled: !!(eventId || title),
  });

  const handleFileDeleted = async (fileId: string) => {
    try {
      const fileToDelete = allFiles.find(f => f.id === fileId);
      
      if (!fileToDelete) {
        console.error('File not found:', fileId);
        return;
      }

      console.log('Deleting file:', fileToDelete);

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([fileToDelete.file_path]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        throw storageError;
      }

      // Delete from both tables to ensure complete cleanup
      const deletePromises = [
        supabase
          .from('event_files')
          .delete()
          .eq('file_path', fileToDelete.file_path),
        supabase
          .from('customer_files_new')
          .delete()
          .eq('file_path', fileToDelete.file_path)
      ];

      await Promise.all(deletePromises);

      if (onFileDeleted) {
        onFileDeleted(fileId);
      }

      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      await queryClient.invalidateQueries({ queryKey: ['eventFiles', eventId, title] });

    } catch (error) {
      console.error('Error in file deletion:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Full Name (required)</Label>
        <Input
          id="title"
          placeholder="Full name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">Phone Number</Label>
        <Input
          id="number"
          type="tel"
          placeholder="Phone number"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialNetwork">Social Link or Email</Label>
        <Input
          id="socialNetwork"
          type="text"
          placeholder="Social link or email"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="bg-background border-input"
        />
        <Input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          className="bg-background border-input"
        />
      </div>

      <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor="amount">Payment Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Enter amount"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            className="bg-background border-input"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Event Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add notes about the event"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="bg-background border-input"
        />
      </div>

      {(eventId || title) && allFiles && allFiles.length > 0 && (
        <div className="space-y-2">
          <FileDisplay 
            files={allFiles} 
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={handleFileDeleted}
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
