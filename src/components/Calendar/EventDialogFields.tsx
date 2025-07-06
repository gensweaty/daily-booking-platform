
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormData {
  user_surname: string;
  user_number: string;
  social_network_link: string;
  event_notes: string;
  event_name: string;
  payment_status: string;
  payment_amount: string;
  start_date: string;
  end_date: string;
}

interface EventDialogFieldsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isRecurring?: boolean;
}

export function EventDialogFields({
  formData,
  setFormData,
  isRecurring = false
}: EventDialogFieldsProps) {
  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4">
      {/* Basic Event Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="user_surname">Name/Title *</Label>
          <Input
            id="user_surname"
            value={formData.user_surname}
            onChange={(e) => handleChange('user_surname', e.target.value)}
            placeholder="Event title or person name"
            required
          />
        </div>
        <div>
          <Label htmlFor="user_number">Phone Number</Label>
          <Input
            id="user_number"
            value={formData.user_number}
            onChange={(e) => handleChange('user_number', e.target.value)}
            placeholder="Contact number"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="social_network_link">Social Network/Email</Label>
        <Input
          id="social_network_link"
          value={formData.social_network_link}
          onChange={(e) => handleChange('social_network_link', e.target.value)}
          placeholder="Social media handle or email"
        />
      </div>

      <div>
        <Label htmlFor="event_name">Event Name</Label>
        <Input
          id="event_name"
          value={formData.event_name}
          onChange={(e) => handleChange('event_name', e.target.value)}
          placeholder="Name of the event"
        />
      </div>

      <div>
        <Label htmlFor="event_notes">Notes</Label>
        <Textarea
          id="event_notes"
          value={formData.event_notes}
          onChange={(e) => handleChange('event_notes', e.target.value)}
          placeholder="Additional notes about the event"
          rows={3}
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start_date">Start Date & Time *</Label>
          <Input
            id="start_date"
            type="datetime-local"
            value={formData.start_date ? new Date(formData.start_date).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              if (e.target.value) {
                handleChange('start_date', new Date(e.target.value).toISOString());
              }
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="end_date">End Date & Time *</Label>
          <Input
            id="end_date"
            type="datetime-local"
            value={formData.end_date ? new Date(formData.end_date).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              if (e.target.value) {
                handleChange('end_date', new Date(e.target.value).toISOString());
              }
            }}
            required
          />
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="payment_status">Payment Status</Label>
          <Select 
            value={formData.payment_status} 
            onValueChange={(value) => handleChange('payment_status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">Not Paid</SelectItem>
              <SelectItem value="partly_paid">Partly Paid</SelectItem>
              <SelectItem value="fully_paid">Fully Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="payment_amount">Payment Amount</Label>
          <Input
            id="payment_amount"
            type="number"
            step="0.01"
            value={formData.payment_amount}
            onChange={(e) => handleChange('payment_amount', e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {isRecurring && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This is a recurring event. The details above will be applied to all instances in the series.
          </p>
        </div>
      )}
    </div>
  );
}
