
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CalendarEventType } from '@/lib/types/calendar';
import { FileUploadField } from '@/components/shared/FileUploadField';

interface EventDialogFieldsProps {
  formData: Partial<CalendarEventType>;
  setFormData: (data: Partial<CalendarEventType>) => void;
  isBookingRequest?: boolean;
  isVirtualEvent?: boolean;
}

export const EventDialogFields: React.FC<EventDialogFieldsProps> = ({
  formData,
  setFormData,
  isBookingRequest,
  isVirtualEvent,
}) => {
  const handleInputChange = (field: keyof CalendarEventType, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleFileChange = (file: File | null) => {
    setFormData({ ...formData, file });
  };

  // Format datetime for input field (YYYY-MM-DDTHH:MM)
  const formatDateTimeForInput = (isoString: string | undefined) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert input datetime to ISO string
  const handleDateTimeChange = (field: keyof CalendarEventType, value: string) => {
    if (value) {
      const date = new Date(value);
      handleInputChange(field, date.toISOString());
    } else {
      handleInputChange(field, '');
    }
  };

  return (
    <div className="space-y-4">
      {/* Basic Event Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Event Title</Label>
          <Input
            id="title"
            value={formData.title || ''}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Enter event title"
          />
        </div>
        
        <div>
          <Label htmlFor="user_surname">Customer Name</Label>
          <Input
            id="user_surname"
            value={formData.user_surname || ''}
            onChange={(e) => handleInputChange('user_surname', e.target.value)}
            placeholder="Enter customer name"
          />
        </div>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="user_number">Phone Number</Label>
          <Input
            id="user_number"
            value={formData.user_number || ''}
            onChange={(e) => handleInputChange('user_number', e.target.value)}
            placeholder="Enter phone number"
          />
        </div>
        
        <div>
          <Label htmlFor="social_network_link">Email</Label>
          <Input
            id="social_network_link"
            type="email"
            value={formData.social_network_link || ''}
            onChange={(e) => handleInputChange('social_network_link', e.target.value)}
            placeholder="Enter email address"
          />
        </div>
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Start Date & Time</Label>
          <Input
            id="start_date"
            type="datetime-local"
            value={formatDateTimeForInput(formData.start_date)}
            onChange={(e) => handleDateTimeChange('start_date', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="end_date">End Date & Time</Label>
          <Input
            id="end_date"
            type="datetime-local"
            value={formatDateTimeForInput(formData.end_date)}
            onChange={(e) => handleDateTimeChange('end_date', e.target.value)}
          />
        </div>
      </div>

      {/* Event Type */}
      <div>
        <Label htmlFor="type">Event Type</Label>
        <Select 
          value={formData.type || 'event'} 
          onValueChange={(value) => handleInputChange('type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="event">General Event</SelectItem>
            <SelectItem value="birthday">Birthday</SelectItem>
            <SelectItem value="private_party">Private Party</SelectItem>
            {isBookingRequest && (
              <SelectItem value="booking_request">Booking Request</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_status">Payment Status</Label>
          <Select 
            value={formData.payment_status || 'not_paid'} 
            onValueChange={(value) => handleInputChange('payment_status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">Not Paid</SelectItem>
              <SelectItem value="partly">Partly Paid</SelectItem>
              <SelectItem value="fully">Fully Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="payment_amount">Payment Amount</Label>
          <Input
            id="payment_amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.payment_amount || ''}
            onChange={(e) => handleInputChange('payment_amount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Email Reminder Section */}
      <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <Label htmlFor="email_reminder" className="text-sm font-medium">
            Email Reminder
          </Label>
          <Switch
            id="email_reminder"
            checked={formData.email_reminder_enabled || false}
            onCheckedChange={(checked) => handleInputChange('email_reminder_enabled', checked)}
          />
        </div>
        
        {formData.email_reminder_enabled && (
          <div>
            <Label htmlFor="reminder_at" className="text-sm">Remind At</Label>
            <Input
              id="reminder_at"
              type="datetime-local"
              value={formatDateTimeForInput(formData.reminder_at)}
              onChange={(e) => handleDateTimeChange('reminder_at', e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Set when to send the reminder email (must be before event start time)
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="event_notes">Notes</Label>
        <Textarea
          id="event_notes"
          value={formData.event_notes || ''}
          onChange={(e) => handleInputChange('event_notes', e.target.value)}
          placeholder="Add any additional notes..."
          rows={3}
        />
      </div>

      {/* File Upload */}
      <div>
        <Label>Attachment</Label>
        <FileUploadField
          onFileChange={handleFileChange}
          existingFile={formData.file}
          accept="image/*,.pdf,.doc,.docx"
          maxSizeMB={10}
        />
      </div>
    </div>
  );
};
