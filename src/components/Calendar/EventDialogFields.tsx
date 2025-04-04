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
  userSurname: string;
  setUserSurname: (surname: string) => void;
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
  fileError: string;
  setFileError: (error: string) => void;
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
  displayedFiles = [],
  isBookingRequest = true,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

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
      {/* Event Title */}
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
        <Label htmlFor="userSurname">{customerLabel}</Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
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
      {eventId && displayedFiles.length > 0 && (
        <Card className="p-4">
          <Label className="mb-2 block">Attached Files</Label>
          <FileDisplay
            files={displayedFiles}
            bucketName="event_attachments"
            allowDelete
            onFileDeleted={onFileDeleted}
          />
        </Card>
      )}

      {/* File Upload */}
      <div className="space-y-2">
        <Label>Attach File</Label>
        <FileUploadField
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />
      </div>
    </div>
  );
};
