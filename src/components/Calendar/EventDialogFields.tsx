import { FileUploadField } from "../shared/FileUploadField";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventFileDisplay } from "./EventFileDisplay";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    setStartDate(e.target.value);

    // If end date is before new start date, update it
    if (new Date(endDate) < newStart) {
      const newEnd = new Date(newStart);
      newEnd.setHours(newEnd.getHours() + 1);
      setEndDate(format(newEnd, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    if (newEnd < new Date(startDate)) {
      toast({
        title: "Invalid Date",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    setEndDate(e.target.value);
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
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={handleStartDateChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            min={startDate}
            onChange={handleEndDateChange}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Payment Status</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select payment status" />
          </SelectTrigger>
          <SelectContent>
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
        <Label>Invoice</Label>
        {eventId && <EventFileDisplay eventId={eventId} />}
        <FileUploadField 
          onFileChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />
      </div>
    </div>
  );
};