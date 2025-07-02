
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { SimpleFileDisplay } from "@/components/shared/SimpleFileDisplay";

interface PersonData {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface ExistingFile {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
}

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
  eventName: string;
  setEventName: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: Date | undefined;
  setRepeatUntil: (value: Date | undefined) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: ExistingFile[];
  onRemoveExistingFile: (fileId: string) => void;
  isNewEvent: boolean;
  additionalPersons: PersonData[];
  setAdditionalPersons: (persons: PersonData[]) => void;
  dataLoading: boolean;
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
  eventName,
  setEventName,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  files,
  setFiles,
  existingFiles,
  onRemoveExistingFile,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  dataLoading
}: EventDialogFieldsProps) => {
  const [showAdditionalPersons, setShowAdditionalPersons] = useState(false);

  // Calculate minimum date for repeat until (should be after start date)
  const getMinRepeatUntilDate = (): Date => {
    if (!startDate) return new Date();
    
    const start = new Date(startDate);
    const minDate = new Date(start);
    
    // Add minimum interval based on pattern
    switch (repeatPattern) {
      case 'daily':
        minDate.setDate(start.getDate() + 1);
        break;
      case 'weekly':
        minDate.setDate(start.getDate() + 7);
        break;
      case 'monthly':
        minDate.setMonth(start.getMonth() + 1);
        break;
      case 'yearly':
        minDate.setFullYear(start.getFullYear() + 1);
        break;
      default:
        minDate.setDate(start.getDate() + 1);
    }
    
    return minDate;
  };

  // Calculate maximum reasonable date (2 years from start)
  const getMaxRepeatUntilDate = (): Date => {
    if (!startDate) {
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2);
      return maxDate;
    }
    
    const start = new Date(startDate);
    const maxDate = new Date(start);
    maxDate.setFullYear(start.getFullYear() + 2);
    return maxDate;
  };

  const addAdditionalPerson = () => {
    const newPerson: PersonData = {
      id: Date.now().toString(),
      userSurname: '',
      userNumber: '',
      socialNetworkLink: '',
      eventNotes: '',
      paymentStatus: 'not_paid',
      paymentAmount: ''
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const removeAdditionalPerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updateAdditionalPerson = (id: string, field: keyof PersonData, value: string) => {
    setAdditionalPersons(additionalPersons.map(person => 
      person.id === id ? { ...person, [field]: value } : person
    ));
  };

  // Enhanced recurring settings validation
  const validateRecurringSettings = () => {
    if (!isRecurring || repeatPattern === 'none') return true;
    
    if (!repeatUntil) {
      console.warn("⚠️ VALIDATION: No repeat until date set for recurring event");
      return false;
    }
    
    const startDateTime = new Date(startDate);
    const minDate = getMinRepeatUntilDate();
    
    if (repeatUntil <= startDateTime) {
      console.warn("⚠️ VALIDATION: Repeat until date must be after start date");
      return false;
    }
    
    if (repeatUntil < minDate) {
      console.warn(`⚠️ VALIDATION: Repeat until date too soon for ${repeatPattern} pattern`);
      return false;
    }
    
    return true;
  };

  // Debug logging for recurring state changes
  React.useEffect(() => {
    console.log("🔁 RECURRING FIELDS STATE:", {
      isRecurring,
      repeatPattern,
      repeatUntil: repeatUntil ? format(repeatUntil, 'yyyy-MM-dd') : null,
      validation: validateRecurringSettings()
    });
  }, [isRecurring, repeatPattern, repeatUntil]);

  if (dataLoading) {
    return <div className="flex justify-center py-8">Loading event data...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Basic Event Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
          />
        </div>
        <div>
          <Label htmlFor="userSurname">Customer Name</Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            placeholder="Customer name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userNumber">Phone Number</Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder="Phone number"
          />
        </div>
        <div>
          <Label htmlFor="socialNetworkLink">Email</Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder="Email address"
            type="email"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="eventName">Event Name</Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="Event name (optional)"
        />
      </div>

      <div>
        <Label htmlFor="eventNotes">Notes</Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder="Event notes"
          rows={3}
        />
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date & Time</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date & Time</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Recurring Event Settings */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="isRecurring"
            checked={isRecurring}
            onCheckedChange={(checked) => {
              console.log("🔁 Recurring switch changed:", checked);
              setIsRecurring(checked);
              if (!checked) {
                setRepeatPattern('none');
                setRepeatUntil(undefined);
              }
            }}
          />
          <Label htmlFor="isRecurring">Recurring Event</Label>
        </div>

        {isRecurring && (
          <div className="space-y-4 ml-6">
            <div>
              <Label htmlFor="repeatPattern">Repeat Pattern</Label>
              <Select
                value={repeatPattern}
                onValueChange={(value) => {
                  console.log("🔁 Repeat pattern changed:", value);
                  setRepeatPattern(value);
                  
                  // Clear repeat until when pattern is 'none'
                  if (value === 'none') {
                    setRepeatUntil(undefined);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select repeat pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {repeatPattern && repeatPattern !== 'none' && (
              <div>
                <Label>Repeat Until</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !repeatUntil && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {repeatUntil ? format(repeatUntil, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={repeatUntil}
                      onSelect={(date) => {
                        console.log("🔁 Repeat until date selected:", date);
                        setRepeatUntil(date);
                      }}
                      disabled={(date) => {
                        const minDate = getMinRepeatUntilDate();
                        const maxDate = getMaxRepeatUntilDate();
                        return date < minDate || date > maxDate;
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {repeatUntil && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Events will be created until {format(repeatUntil, "PPP")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <div>
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
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
          <Label htmlFor="paymentAmount">Payment Amount</Label>
          <Input
            id="paymentAmount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="Amount"
          />
        </div>
      </div>

      {/* File Upload */}
      <div className="border-t pt-4">
        <Label>Attachments</Label>
        <FileUploadField
          onFileChange={(file) => {
            if (file) {
              setFiles([...files, file]);
            }
          }}
          maxSizeMB={5}
          acceptedFileTypes="image/*,.pdf,.doc,.docx"
        />
        
        {existingFiles.length > 0 && (
          <div className="mt-4">
            <Label>Existing Files</Label>
            <div className="space-y-2">
              <SimpleFileDisplay
                files={existingFiles.map(file => ({
                  id: file.id,
                  filename: file.filename,
                  file_path: file.file_path,
                  content_type: file.content_type || '',
                  size: file.size || 0,
                  created_at: new Date().toISOString(),
                  user_id: null
                }))}
                parentType="event"
                allowDelete={true}
                onFileDeleted={onRemoveExistingFile}
              />
            </div>
          </div>
        )}
      </div>

      {/* Additional Persons */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>Additional Persons</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdditionalPersons(!showAdditionalPersons)}
          >
            {showAdditionalPersons ? 'Hide' : 'Show'} Additional Persons
          </Button>
        </div>

        {showAdditionalPersons && (
          <div className="mt-4 space-y-4">
            {additionalPersons.map((person) => (
              <div key={person.id} className="border p-4 rounded-md space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="font-medium">Additional Person</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAdditionalPerson(person.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Name"
                    value={person.userSurname}
                    onChange={(e) => updateAdditionalPerson(person.id, 'userSurname', e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    value={person.userNumber}
                    onChange={(e) => updateAdditionalPerson(person.id, 'userNumber', e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={person.socialNetworkLink}
                    onChange={(e) => updateAdditionalPerson(person.id, 'socialNetworkLink', e.target.value)}
                  />
                  <Select
                    value={person.paymentStatus}
                    onValueChange={(value) => updateAdditionalPerson(person.id, 'paymentStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_paid">Not Paid</SelectItem>
                      <SelectItem value="partly_paid">Partly Paid</SelectItem>
                      <SelectItem value="fully_paid">Fully Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Input
                  placeholder="Payment Amount"
                  type="number"
                  value={person.paymentAmount}
                  onChange={(e) => updateAdditionalPerson(person.id, 'paymentAmount', e.target.value)}
                />
                
                <Textarea
                  placeholder="Notes"
                  value={person.eventNotes}
                  onChange={(e) => updateAdditionalPerson(person.id, 'eventNotes', e.target.value)}
                  rows={2}
                />
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={addAdditionalPerson}
              className="w-full"
            >
              Add Additional Person
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
