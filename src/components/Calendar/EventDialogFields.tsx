import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Plus, X } from "lucide-react";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { getRepeatOptions } from "@/lib/recurringEvents";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

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
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  additionalPersons: Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>;
  setAdditionalPersons: (persons: Array<{
    id: string;
    userSurname: string;
    userNumber: string;
    socialNetworkLink: string;
    eventNotes: string;
    paymentStatus: string;
    paymentAmount: string;
  }>) => void;
  isNewEvent: boolean;
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
  additionalPersons,
  setAdditionalPersons,
  isNewEvent
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();
  
  // Get dynamic repeat options based on start date
  const repeatOptions = getRepeatOptions(startDate ? new Date(startDate) : undefined, t);

  const addAdditionalPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: crypto.randomUUID(),
        userSurname: "",
        userNumber: "",
        socialNetworkLink: "",
        eventNotes: "",
        paymentStatus: "",
        paymentAmount: ""
      }
    ]);
  };

  const removeAdditionalPerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updateAdditionalPerson = (id: string, field: string, value: string) => {
    setAdditionalPersons(
      additionalPersons.map(person =>
        person.id === id ? { ...person, [field]: value } : person
      )
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Basic Event Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Event Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="userSurname">Customer Name</Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="userNumber">Phone Number</Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="socialNetworkLink">Email/Social Media</Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="eventName">Event Type</Label>
          <Input
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
          />
        </div>
      </div>

      {/* Date/Time and Payment Information */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="startDate">Start Date & Time *</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="endDate">End Date & Time *</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="paymentStatus">Payment Status</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="paymentAmount">Payment Amount</Label>
          <Input
            id="paymentAmount"
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
        </div>
      </div>

      {/* Full width sections */}
      <div className="md:col-span-2 space-y-4">
        {/* Recurring Event Section */}
        {isNewEvent && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center space-x-2">
              <Switch
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
              <Label htmlFor="isRecurring">{t("recurring.makeRecurring")}</Label>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="repeatPattern">{t("recurring.repeatPattern")}</Label>
                  <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("recurring.selectPattern")} />
                    </SelectTrigger>
                    <SelectContent>
                      {repeatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="repeatUntil">{t("recurring.repeatUntil")}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {repeatUntil ? format(new Date(repeatUntil), "PPP") : t("recurring.selectEndDate")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={repeatUntil ? new Date(repeatUntil) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            // Ensure we only send date part (YYYY-MM-DD)
                            const dateStr = format(date, "yyyy-MM-dd");
                            setRepeatUntil(dateStr);
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="eventNotes">Event Notes</Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <FileUploadField
          files={files}
          onFilesChange={setFiles}
          label="Event Attachments"
        />

        {/* Additional Persons Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Additional Participants</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAdditionalPerson}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Person
            </Button>
          </div>

          {additionalPersons.map((person) => (
            <div key={person.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Additional Person</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAdditionalPerson(person.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={person.userSurname}
                    onChange={(e) => updateAdditionalPerson(person.id, "userSurname", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Phone</Label>
                  <Input
                    value={person.userNumber}
                    onChange={(e) => updateAdditionalPerson(person.id, "userNumber", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Email/Social</Label>
                  <Input
                    value={person.socialNetworkLink}
                    onChange={(e) => updateAdditionalPerson(person.id, "socialNetworkLink", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Payment Status</Label>
                  <Select
                    value={person.paymentStatus}
                    onValueChange={(value) => updateAdditionalPerson(person.id, "paymentStatus", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label>Payment Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={person.paymentAmount}
                    onChange={(e) => updateAdditionalPerson(person.id, "paymentAmount", e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={person.eventNotes}
                    onChange={(e) => updateAdditionalPerson(person.id, "eventNotes", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
