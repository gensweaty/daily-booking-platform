import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { da, enUS, es, ka } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Asterisk } from 'lucide-react';
import { getGeorgianFontStyle } from '@/lib/font-utils';
import { getCurrencySymbol } from '@/lib/currency';

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | undefined;
  businessId: string;
  onEventCreated?: () => void;
  onEventUpdated?: () => void;
  eventData?: any;
}

export function EventDialog({
  open,
  onOpenChange,
  selectedDate,
  businessId,
  onEventCreated,
  onEventUpdated,
  eventData
}: EventDialogProps) {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userSurname, setUserSurname] = useState('');
  const [userNumber, setUserNumber] = useState('');
  const [socialNetworkLink, setSocialNetworkLink] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Get currency symbol based on language
  const currencySymbol = getCurrencySymbol(language);
  
  const { toast } = useToast();

  useEffect(() => {
    if (eventData) {
      setTitle(eventData.title || '');
      setDescription(eventData.description || '');
      setLocation(eventData.location || '');
      setStartDate(eventData.start_date ? format(new Date(eventData.start_date), "yyyy-MM-dd'T'HH:mm") : '');
      setEndDate(eventData.end_date ? format(new Date(eventData.end_date), "yyyy-MM-dd'T'HH:mm") : '');
      setUserSurname(eventData.user_surname || '');
      setUserNumber(eventData.user_number || '');
      setSocialNetworkLink(eventData.social_network_link || '');
      setEventNotes(eventData.event_notes || '');
      setPaymentStatus(eventData.payment_status || 'not_paid');
      setPaymentAmount(eventData.payment_amount ? String(eventData.payment_amount) : '');
    } else if (selectedDate) {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(9, 0, 0, 0); // Set to 9:00 AM
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(10, 0, 0, 0); // Set to 10:00 AM

      setStartDate(format(startOfDay, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(endOfDay, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [eventData, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!title) {
        toast.error({
          title: t("common.error"),
          description: t("events.titleRequired")
        });
        setIsSubmitting(false);
        return;
      }

      if (!userSurname) {
        toast.error({
          title: t("common.error"),
          description: t("events.fullNameRequired")
        });
        setIsSubmitting(false);
        return;
      }

      if (!userNumber) {
        toast.error({
          title: t("common.error"),
          description: t("events.phoneNumberRequired")
        });
        setIsSubmitting(false);
        return;
      }

      if (!socialNetworkLink || !socialNetworkLink.includes('@')) {
        toast.error({
          title: t("common.error"),
          description: t("events.validEmailRequired")
        });
        setIsSubmitting(false);
        return;
      }

      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);

      // Additional validation for dates
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        toast.error({
          title: t("common.error"),
          description: t("events.validDatesRequired")
        });
        setIsSubmitting(false);
        return;
      }

      // Process payment amount - Parse numeric value only without currency symbol
      let finalPaymentAmount = null;
      if (paymentAmount) {
        // Remove any currency symbols or non-numeric characters except decimal point
        const cleanedAmount = paymentAmount.replace(/[^\d.]/g, '');
        const amount = parseFloat(cleanedAmount);
        if (!isNaN(amount)) {
          finalPaymentAmount = amount;
        }
      }

      const eventDataToSubmit = {
        business_id: businessId,
        title: title,
        description: description || null,
        location: location || null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        user_surname: userSurname,
        user_number: userNumber,
        social_network_link: socialNetworkLink,
        event_notes: eventNotes || null,
        payment_status: paymentStatus,
        payment_amount: finalPaymentAmount,
        language: language
      };

      if (eventData) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventDataToSubmit)
          .eq('id', eventData.id);

        if (error) {
          console.error('Error updating event:', error);
          throw error;
        }
        if (onEventUpdated) {
          onEventUpdated();
        }
      } else {
        // Create new event
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert([eventDataToSubmit])
          .select()
          .single();

        if (error) {
          console.error('Error creating event:', error);
          throw error;
        }

        if (onEventCreated) {
          onEventCreated();
        }

        // If a new event was created, use its ID
        if (newEvent) {
          const eventId = newEvent.id;

          // If there's a selected file, upload it
          if (selectedFile && eventId) {
            const fileExt = selectedFile.name.split('.').pop();
            const filePath = `${eventId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('event_attachments')
              .upload(filePath, selectedFile);

            if (uploadError) {
              console.error('Error uploading file:', uploadError);
              throw uploadError;
            }

            const fileRecord = {
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
              event_id: eventId
            };

            const { error: fileRecordError } = await supabase
              .from('event_files')
              .insert(fileRecord);

            if (fileRecordError) {
              console.error('Error creating file record:', fileRecordError);
              throw fileRecordError;
            }
          }
        }
      }

      setIsSubmitting(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting form:', error);
      setIsSubmitting(false);
      toast.error({
        title: t("common.error"),
        description: t("common.errorOccurred")
      });
    }
  };

  const getEventNotesPlaceholder = () => {
    if (isGeorgian) {
      return "დაამატეთ შენიშვნები თქვენი მოთხოვნის შესახებ";
    }
    return t("events.addEventNotes");
  };

  const georgianFontStyle = isGeorgian ? getGeorgianFontStyle() : undefined;
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  const showPaymentAmount = paymentStatus === "partly_paid" || paymentStatus === "fully_paid";

  // Create a required field indicator component
  const RequiredFieldIndicator = () => (
    <Asterisk className="inline h-3 w-3 text-destructive ml-1" />
  );

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setFileError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="semibold">
                {eventData ? "ღონისძიების განახლება" : "ახალი ღონისძიების დამატება"}
              </GeorgianAuthText>
            ) : (
              <LanguageText>
                {eventData ? t('events.updateEvent') : t('events.addEvent')}
              </LanguageText>
            )}
          </DialogTitle>
          <DialogDescription>
            {isGeorgian ? (
              <GeorgianAuthText>
                {eventData ? "განაახლეთ თქვენი ღონისძიების დეტალები აქ. დააჭირეთ შენახვას ცვლილებების შესატანად." : "აქ შეგიძლიათ დაამატოთ ახალი მოვლენა თქვენს კალენდარში."}
              </GeorgianAuthText>
            ) : (
              <LanguageText>
                {eventData ? t('events.updateEventDescription') : t('events.addEventDescription')}
              </LanguageText>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Title Field */}
          <div>
            <Label htmlFor="title" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <>
                  <GeorgianAuthText fontWeight="medium">სათაური</GeorgianAuthText>
                  <RequiredFieldIndicator />
                </>
              ) : (
                <>
                  {t("events.title")}
                  <RequiredFieldIndicator />
                </>
              )}
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isGeorgian ? "შეიყვანეთ სათაური" : t("events.enterTitle")}
              required
              className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* Description Field */}
          <div>
            <Label htmlFor="description" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">აღწერა</GeorgianAuthText>
              ) : (
                t("events.description")
              )}
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isGeorgian ? "შეიყვანეთ აღწერა" : t("events.enterDescription")}
              className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* Location Field */}
          <div>
            <Label htmlFor="location" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">ადგილმდებარეობა</GeorgianAuthText>
              ) : (
                t("events.location")
              )}
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={isGeorgian ? "შეიყვანეთ ადგილმდებარეობა" : t("events.enterLocation")}
              className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* Date and Time Fields */}
          <div>
            <Label htmlFor="dateTime" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <>
                  <GeorgianAuthText fontWeight="medium">თარიღი და დრო</GeorgianAuthText>
                  <RequiredFieldIndicator />
                </>
              ) : (
                <>
                  {t("events.dateAndTime")}
                  <RequiredFieldIndicator />
                </>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianFontStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText>დაწყება</GeorgianAuthText>
                  ) : (
                    t("events.start")
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full"
                    style={{ colorScheme: 'auto' }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianFontStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText>დასრულება</GeorgianAuthText>
                  ) : (
                    t("events.end")
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full"
                    style={{ colorScheme: 'auto' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Surname Field */}
          <div>
            <Label htmlFor="userSurname" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <>
                  <GeorgianAuthText fontWeight="medium">სრული სახელი</GeorgianAuthText>
                  <RequiredFieldIndicator />
                </>
              ) : (
                <>
                  {t("events.fullName")}
                  <RequiredFieldIndicator />
                </>
              )}
            </Label>
            <Input
              id="userSurname"
              value={userSurname}
              onChange={(e) => setUserSurname(e.target.value)}
              placeholder={isGeorgian ? "შეიყვანეთ სახელი და გვარი" : t("events.enterFullName")}
              required
              className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* User Number Field */}
          <div>
            <Label htmlFor="userNumber" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <>
                  <GeorgianAuthText fontWeight="medium">ტელეფონის ნომერი</GeorgianAuthText>
                  <RequiredFieldIndicator />
                </>
              ) : (
                <>
                  {t("events.phoneNumber")}
                  <RequiredFieldIndicator />
                </>
              )}
            </Label>
            <Input
              id="userNumber"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              placeholder={isGeorgian ? "შეიყვანეთ ტელეფონის ნომერი" : t("events.enterPhoneNumber")}
              required
              className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* Social Network Link Field */}
          <div>
            <Label htmlFor="socialNetworkLink" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <>
                  <GeorgianAuthText fontWeight="medium">ელფოსტა / სოციალური ქსელის ბმული</GeorgianAuthText>
                  <RequiredFieldIndicator />
                </>
              ) : (
                <>
                  {t("events.socialLinkEmail")}
                  <RequiredFieldIndicator />
                </>
              )}
            </Label>
            <Input
              id="socialNetworkLink"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              placeholder="email@example.com"
              type="email"
              required
              style={georgianFontStyle}
            />
          </div>

          {/* Payment Status Dropdown */}
          <div>
            <Label htmlFor="paymentStatus" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">გადახდის სტატუსი</GeorgianAuthText>
              ) : (
                t("events.paymentStatus")
              )}
            </Label>
            <Select
              value={paymentStatus}
              onValueChange={setPaymentStatus}
            >
              <SelectTrigger id="paymentStatus" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                <SelectValue placeholder={isGeorgian ? "აირჩიეთ გადახდის სტატუსი" : t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent className={`bg-background ${isGeorgian ? "font-georgian" : ""}`}>
                <SelectItem value="not_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                  {isGeorgian ? "გადაუხდელი" : t("crm.notPaid")}
                </SelectItem>
                <SelectItem value="partly_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                  {isGeorgian ? "ნაწილობრივ გადახდილი" : t("crm.paidPartly")}
                </SelectItem>
                <SelectItem value="fully_paid" className={isGeorgian ? "font-georgian" : ""} style={georgianFontStyle}>
                  {isGeorgian ? "სრულად გადახდილი" : t("crm.paidFully")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Amount Field - conditionally visible with currency symbol */}
          {showPaymentAmount && (
            <div>
              <Label htmlFor="paymentAmount" className={labelClass} style={georgianFontStyle}>
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="medium">გადახდის ოდენობა</GeorgianAuthText>
                ) : (
                  t("events.paymentAmount")
                )}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {currencySymbol}
                </span>
                <Input
                  id="paymentAmount"
                  value={paymentAmount.replace(/^[^0-9.]*/, '')} // Remove any non-numeric prefix (like currency symbol) when displaying
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and decimal point
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setPaymentAmount(value);
                    }
                  }}
                  placeholder="0.00"
                  type="text"
                  inputMode="decimal"
                  className={cn(isGeorgian ? "font-georgian" : "", "pl-7")} // Added left padding to make room for currency symbol
                  style={georgianFontStyle}
                  aria-label={`${t("events.paymentAmount")} (${currencySymbol})`}
                />
              </div>
            </div>
          )}

          {/* Event Notes Field */}
          <div>
            <Label htmlFor="eventNotes" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">შენიშვნები</GeorgianAuthText>
              ) : (
                t("events.eventNotes")
              )}
            </Label>
            <Textarea
              id="eventNotes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              placeholder={getEventNotesPlaceholder()}
              className={cn("min-h-[100px] resize-none", isGeorgian ? "placeholder:font-georgian font-georgian" : "")}
              style={georgianFontStyle}
            />
          </div>

          {/* File Upload Field */}
          <div>
            <Label htmlFor="file" className={labelClass} style={georgianFontStyle}>
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="medium">ატვირთეთ ფაილი</GeorgianAuthText>
              ) : (
                t("events.uploadFile")
              )}
            </Label>
            <FileUploadField
              onChange={handleFileChange}
              fileError={fileError}
              setFileError={setFileError}
              selectedFile={selectedFile}
              ref={fileInputRef}
              acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              hideLabel={true}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting} onClick={handleSubmit}>
            {isGeorgian ? (
              <GeorgianAuthText fontWeight="medium">
                {isSubmitting ? "იტვირთება..." : "შენახვა"}
              </GeorgianAuthText>
            ) : (
              <LanguageText>
                {isSubmitting ? t('common.submitting') : t('common.save')}
              </LanguageText>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
