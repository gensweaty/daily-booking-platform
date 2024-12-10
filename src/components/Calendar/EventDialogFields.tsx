import { FileUploadField } from "../shared/FileUploadField";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
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
}

export const EventDialogFields = ({
  title,
  setTitle,
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
}: EventDialogFieldsProps) => {
  const { data: existingFiles } = useQuery({
    queryKey: ['eventFiles', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      console.log('Fetching files for event:', eventId);
      const { data, error } = await supabase
        .from('event_files')
        .select('*')
        .eq('event_id', eventId);
      
      if (error) {
        console.error('Error fetching event files:', error);
        throw error;
      }
      console.log('Retrieved files:', data);
      return data || [];
    },
    enabled: !!eventId,
  });

  const handleFileClick = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('event_attachments')
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Name and Surname (required)</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name and Surname"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder="Phone number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="social">Social Link or Email</Label>
        <Input
          id="social"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder="Social link or email"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
        <Input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Payment Status</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select payment status" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            <SelectItem value="not_paid">Not paid</SelectItem>
            <SelectItem value="partly">Paid Partly</SelectItem>
            <SelectItem value="fully">Paid Fully</SelectItem>
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
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="Enter amount"
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Event Notes</Label>
        <Textarea
          id="notes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder="Add notes about the event"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor="file">Invoice</Label>
          {existingFiles && existingFiles.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              (Current file: 
              <button 
                onClick={() => handleFileClick(existingFiles[0].file_path)}
                className="text-primary hover:underline ml-1"
              >
                {existingFiles[0].filename}
              </button>)
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">(Attachment optional)</span>
          )}
        </div>
        <FileUploadField 
          onFileChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />
      </div>
    </div>
  );
};