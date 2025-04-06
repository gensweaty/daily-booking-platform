
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "../shared/FileDisplay";
import { FileUploadField } from "../shared/FileUploadField";

// Define field props for easier testing and integration
export interface EventDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  surname: string;
  setSurname: (surname: string) => void;
  userNumber: string;
  setUserNumber: (number: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (link: string) => void;
  eventNotes: string;
  setEventNotes: (notes: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError?: string;
  setFileError?: (error: string) => void;
  isBookingRequest?: boolean;
  eventId?: string;
  onFileDeleted?: (fileId: string) => void;
  displayedFiles?: Array<{
    id: string;
    filename: string;
    content_type?: string;
  }>;
}

export const EventDialogFields = ({
  title,
  setTitle,
  surname,
  setSurname,
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
  fileError = "",
  setFileError = () => {},
  eventId,
  onFileDeleted,
  displayedFiles = [],
  isBookingRequest = true,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

  console.log("EventDialogFields - displayedFiles:", displayedFiles);

  // Reset payment amount when payment status changes to "not_paid"
  useEffect(() => {
    if (paymentStatus === "not_paid") {
      setPaymentAmount("");
    }
  }, [paymentStatus, setPaymentAmount]);

  // Function to handle formatted date inputs
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toISOString().slice(0, 16);
    } catch (error) {
      return dateString;
    }
  };

  // Labels based on whether this is a booking request or internal event
  const customerLabel = isBookingRequest ? "Your Name" : "Customer Name";
  const phoneLabel = isBookingRequest ? "Your Phone" : "Customer Phone";
  const emailLabel = isBookingRequest ? "Your Email" : "Contact Info";

  return (
    <div className="space-y-4">
      {/* Title field */}
      <div className="space-y-2">
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter event title"
          required
        />
      </div>

      {/* Customer Name */}
      <div className="space-y-2">
        <Label htmlFor="surname">{customerLabel}</Label>
        <Input
          id="surname"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="Enter name"
          required
        />
      </div>

      {/* Phone Number */}
      <div className="space-y-2">
        <Label htmlFor="userNumber">{phoneLabel}</Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder="Enter phone number"
        />
      </div>

      {/* Social Network / Contact Info */}
      <div className="space-y-2">
        <Label htmlFor="socialNetworkLink">{emailLabel}</Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={isBookingRequest ? "Enter your email" : "Enter contact info"}
          required={isBookingRequest}
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date & Time</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={formatDateForInput(startDate)}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date & Time</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={formatDateForInput(endDate)}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Payment Status and Amount */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Select
            value={paymentStatus}
            onValueChange={setPaymentStatus}
          >
            <SelectTrigger id="paymentStatus">
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">Not Paid</SelectItem>
              <SelectItem value="partly">Partly Paid</SelectItem>
              <SelectItem value="fully">Fully Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentStatus !== "not_paid" && (
          <div className="space-y-2">
            <Label htmlFor="paymentAmount">Payment Amount</Label>
            <Input
              id="paymentAmount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter payment amount"
              required={paymentStatus !== "not_paid"}
            />
          </div>
        )}
      </div>

      {/* Event Notes */}
      <div className="space-y-2">
        <Label htmlFor="eventNotes">Notes</Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder="Additional notes"
          rows={3}
        />
      </div>

      {/* Existing Files */}
      {displayedFiles.length > 0 && (
        <Card className="p-4">
          <FileDisplay
            files={displayedFiles}
            bucketName="event_attachments"
            allowDelete={!!onFileDeleted}
            onFileDeleted={onFileDeleted}
          />
        </Card>
      )}

      {/* File Upload - simplified */}
      <div className="space-y-2">
        <input
          type="file"
          id="file"
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-primary-foreground
            hover:file:bg-primary/90
            cursor-pointer"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setSelectedFile(e.target.files[0]);
              if (setFileError) setFileError("");
            }
          }}
        />
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>
    </div>
  );
};
