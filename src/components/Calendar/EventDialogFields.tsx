
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, RefreshCcw, Plus, X } from "lucide-react";
import { CalendarEventType } from "@/lib/types/calendar";
import { FileRecord } from "@/types/files";

interface EventDialogFieldsProps {
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
  eventName: string;
  setEventName: (name: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  isRecurring: boolean;
  setIsRecurring: (recurring: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (pattern: string) => void;
  repeatUntil: string;
  setRepeatUntil: (until: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: FileRecord[];
  setExistingFiles: (files: FileRecord[]) => void;
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
  isVirtualEvent: boolean;
  isNewEvent: boolean;
  initialData?: CalendarEventType;
  language: string;
  t: (key: string) => string;
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
  setExistingFiles,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent,
  isNewEvent,
  initialData,
  language,
  t
}: EventDialogFieldsProps) => {
  
  const addPerson = () => {
    setAdditionalPersons([
      ...additionalPersons,
      {
        id: `temp-${Date.now()}`,
        userSurname: '',
        userNumber: '',
        socialNetworkLink: '',
        eventNotes: '',
        paymentStatus: '',
        paymentAmount: ''
      }
    ]);
  };

  const removePerson = (index: number) => {
    setAdditionalPersons(additionalPersons.filter((_, i) => i !== index));
  };

  const updatePerson = (index: number, field: string, value: string) => {
    const updated = [...additionalPersons];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalPersons(updated);
  };

  const handleFileUpload = (file: File | null) => {
    if (file) {
      setFiles([...files, file]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date & Time Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Date & Time</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate" className="text-sm font-medium text-foreground">
              Start
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background border-input"
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate" className="text-sm font-medium text-foreground">
              End
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background border-input"
              required
            />
          </div>
        </div>
      </div>

      {/* Created/Updated metadata section - only show for existing events */}
      {initialData && (
        <div className="bg-muted/50 rounded-lg p-3 border border-muted">
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="flex items-center mr-4">
              <Clock className="mr-1 h-4 w-4" />
              <span>{t("tasks.createdAt")}: {new Date(initialData.created_at).toLocaleString(language)}</span>
            </span>
            <span className="flex items-center">
              <RefreshCcw className="mr-1 h-4 w-4" />
              <span>{t("tasks.lastUpdated")}: {new Date(initialData.created_at).toLocaleString(language)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Person Data Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Person Data</h3>
        
        {/* Main Person */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="userSurname" className="text-sm font-medium text-foreground">
              Full Name
            </Label>
            <Input
              id="userSurname"
              value={userSurname}
              onChange={(e) => setUserSurname(e.target.value)}
              className="bg-background border-input"
              placeholder="Enter full name"
            />
          </div>
          
          <div>
            <Label htmlFor="userNumber" className="text-sm font-medium text-foreground">
              Phone Number
            </Label>
            <Input
              id="userNumber"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              className="bg-background border-input"
              placeholder="Enter phone number"
            />
          </div>
          
          <div>
            <Label htmlFor="socialNetworkLink" className="text-sm font-medium text-foreground">
              Email
            </Label>
            <Input
              id="socialNetworkLink"
              type="email"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              className="bg-background border-input"
              placeholder="Enter email address"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentStatus" className="text-sm font-medium text-foreground">
                Payment Status
              </Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Paid Partly</SelectItem>
                  <SelectItem value="not_paid">Not Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="paymentAmount" className="text-sm font-medium text-foreground">
                Payment Amount
              </Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="bg-background border-input"
                placeholder="Enter amount"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="eventNotes" className="text-sm font-medium text-foreground">
              Notes
            </Label>
            <Textarea
              id="eventNotes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              className="bg-background border-input min-h-[80px]"
              placeholder="Enter notes"
            />
          </div>
        </div>

        {/* Additional Persons */}
        {additionalPersons.map((person, index) => (
          <Card key={person.id} className="relative">
            <CardContent className="p-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={() => removePerson(index)}
              >
                <X className="h-4 w-4" />
              </Button>
              
              <h4 className="font-medium text-foreground mb-4">Additional Person {index + 1}</h4>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Full Name
                  </Label>
                  <Input
                    value={person.userSurname}
                    onChange={(e) => updatePerson(index, 'userSurname', e.target.value)}
                    className="bg-background border-input"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Phone Number
                  </Label>
                  <Input
                    value={person.userNumber}
                    onChange={(e) => updatePerson(index, 'userNumber', e.target.value)}
                    className="bg-background border-input"
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={person.socialNetworkLink}
                    onChange={(e) => updatePerson(index, 'socialNetworkLink', e.target.value)}
                    className="bg-background border-input"
                    placeholder="Enter email address"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Payment Status
                    </Label>
                    <Select 
                      value={person.paymentStatus} 
                      onValueChange={(value) => updatePerson(index, 'paymentStatus', value)}
                    >
                      <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Select payment status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partially_paid">Paid Partly</SelectItem>
                        <SelectItem value="not_paid">Not Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Payment Amount
                    </Label>
                    <Input
                      type="number"
                      value={person.paymentAmount}
                      onChange={(e) => updatePerson(index, 'paymentAmount', e.target.value)}
                      className="bg-background border-input"
                      placeholder="Enter amount"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Notes
                  </Label>
                  <Textarea
                    value={person.eventNotes}
                    onChange={(e) => updatePerson(index, 'eventNotes', e.target.value)}
                    className="bg-background border-input min-h-[80px]"
                    placeholder="Enter notes"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        <Button type="button" variant="outline" onClick={addPerson} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Person
        </Button>
      </div>

      {/* Recurring Events Section */}
      {!isVirtualEvent && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
            <Label htmlFor="isRecurring" className="text-sm font-medium text-foreground">
              Make this a recurring event
            </Label>
          </div>
          
          {isRecurring && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="repeatPattern" className="text-sm font-medium text-foreground">
                  Repeat Pattern
                </Label>
                <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                  <SelectTrigger className="bg-background border-input">
                    <SelectValue placeholder="Select repeat pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="repeatUntil" className="text-sm font-medium text-foreground">
                  Repeat Until
                </Label>
                <Input
                  id="repeatUntil"
                  type="date"
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  className="bg-background border-input"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Attachments Section */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">File Attachments</h3>
        
        {existingFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Current Attachments</Label>
            <FileDisplay 
              files={existingFiles} 
              bucketName="event_attachments"
              allowDelete
              parentType="event"
            />
          </div>
        )}
        
        <FileUploadField 
          onChange={handleFileUpload}
          fileError=""
          setFileError={() => {}}
        />
      </div>
    </div>
  );
};
