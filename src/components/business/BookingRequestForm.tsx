import React, { useState, useEffect, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { FileUploadField } from '../shared/FileUploadField';
import { FileRecord } from '@/types/files';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrencySymbol } from '@/lib/currency';

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Invalid email address.",
  }),
  phone: z.string().optional(),
  notes: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  startHour: z.number().optional(),
  startMinute: z.number().optional(),
  endHour: z.number().optional(),
  endMinute: z.number().optional(),
  hasAttachment: z.boolean().default(false).optional(),
  paymentStatus: z.string().optional(),
  paymentAmount: z.number().optional(),
});

interface BookingRequestFormProps {
  businessId: string;
  isOpen?: boolean;
  onClose?: () => void;
  onRequestSubmitted?: () => void;
  onSuccess?: () => void;
  businessInfo?: {
    business_name?: string;
    contact_address?: string;
  };
  // Add props needed by Calendar.tsx
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  isExternalBooking?: boolean;
}

export type FileUploadResult = {
  file_path: string;
  filename: string;
  id: string;
}

export const BookingRequestForm = ({ 
  businessId, 
  isOpen = false, 
  onClose = () => {}, 
  onRequestSubmitted = () => {}, 
  onSuccess = () => {},
  businessInfo,
  selectedDate: initialSelectedDate,
  startTime,
  endTime,
  isExternalBooking = false
}: BookingRequestFormProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [step, setStep] = useState<'date' | 'details'>('date');
  const [showPaymentAmount, setShowPaymentAmount] = useState(false);
  const currencySymbol = getCurrencySymbol(language);
  
  const [selectedDate, setSelectedDate] = useState<Date>(initialSelectedDate || new Date());
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      startDate: selectedDate,
      endDate: selectedDate,
      hasAttachment: false,
      paymentStatus: 'not_paid',
      paymentAmount: 0,
    },
  });

  useEffect(() => {
    if (initialSelectedDate) {
      setSelectedDate(initialSelectedDate);
      form.setValue("startDate", initialSelectedDate);
      form.setValue("endDate", initialSelectedDate);
    }
  }, [initialSelectedDate, form]);

  // Set initial time values if provided
  useEffect(() => {
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      form.setValue("startHour", hours);
      form.setValue("startMinute", minutes);
    }
    
    if (endTime) {
      const [hours, minutes] = endTime.split(':').map(Number);
      form.setValue("endHour", hours);
      form.setValue("endMinute", minutes);
    }
  }, [startTime, endTime, form]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      form.setValue("startDate", date);
      form.setValue("endDate", date);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (file) {
      // Generate a unique ID for the file
      const fileId = crypto.randomUUID();
      // Create a FileRecord from the file
      const newFileRecord: FileRecord = {
        id: fileId,
        filename: file.name,
        file_path: '', // This will be populated after upload
        content_type: file.type,
        size: file.size,
        created_at: new Date().toISOString(),
        user_id: null,
      };
      
      // Store file for later upload
      setFiles(prevFiles => [...prevFiles, { ...newFileRecord, file }]);
    }
  };

  const handleFilesUploaded = (newFiles: FileRecord[]) => {
    setFiles(newFiles);
    form.setValue("hasAttachment", newFiles.length > 0);
  };

  const handleRemoveFile = (fileToRemove: FileRecord) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileToRemove.id));
    form.setValue("hasAttachment", files.length > 0);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setSubmitting(true);
    
    try {
      // First, upload any files to storage
      let fileIds: string[] = [];
      if (files.length > 0) {
        const uploadPromises = files.map(async (fileRecord) => {
          // We need to make sure we have the actual File object
          // @ts-ignore - we're adding the file property temporarily
          const file = fileRecord.file;
          if (!file) {
            console.error('File object missing from record:', fileRecord);
            return undefined;
          }
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('booking-attachments')
            .upload(`${businessId}/${fileRecord.filename}`, file, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw new Error(t('bookingRequest.fileUploadError'));
          }
          
          return uploadData?.path;
        });
        
        const uploadedPaths = await Promise.all(uploadPromises);
        fileIds = uploadedPaths.filter(path => path !== undefined) as string[];
      }
      
      // Send notification to business owner
      try {
        const startDateTime = selectedDate.setHours(data.startHour || 0, data.startMinute || 0);
        const endDateTime = selectedDate.setHours(data.endHour || 0, data.endMinute || 0);
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-booking-request-notification`, {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessId,
            requesterName: data.name,
            requesterEmail: data.email,
            requesterPhone: data.phone,
            notes: data.notes || 'No additional notes',
            startDate: startDateTime,
            endDate: endDateTime,
            hasAttachment: files.length > 0,
            paymentStatus: data.paymentStatus,
            paymentAmount: data.paymentAmount,
            businessName: businessInfo?.business_name || '',
            businessAddress: businessInfo?.contact_address || '',
            language: language
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to send booking notification:', errorData);
          throw new Error(t('bookingRequest.notificationError'));
        }
        
        const responseData = await response.json();
        console.log('Booking notification sent:', responseData);
      } catch (error) {
        console.error('Error sending booking notification:', error);
      }
      
      // Create the booking request in the database - Fix the property name to match the database schema
      const { error } = await supabase
        .from('booking_requests')
        .insert({
          business_id: businessId,
          requester_name: data.name,
          requester_email: data.email,
          requester_phone: data.phone,
          description: data.notes || 'No additional notes',
          title: 'Booking Request',  // Add title field as it's required
          start_date: selectedDate.setHours(data.startHour || 0, data.startMinute || 0),
          end_date: selectedDate.setHours(data.endHour || 0, data.endMinute || 0),
          attachment_ids: fileIds,
          status: 'pending',
          payment_status: data.paymentStatus,
          payment_amount: data.paymentAmount,
          language: language
        });
      
      if (error) {
        console.error('Error creating booking request:', error);
        throw new Error(t('bookingRequest.createError'));
      }
      
      // Success path
      toast({
        title: t('bookingRequest.success'),
        description: t('bookingRequest.successMessage'),
      });
      
      // Reset fields
      reset();
      setFiles([]);
      setStep('date');
      onRequestSubmitted();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error submitting booking request:', error);
      toast({
        title: t('common.error'),
        description: t('bookingRequest.errorMessage'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      onClose();
    }
  };
  
  const { reset } = form;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('bookingRequest.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          {step === 'date' && (
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('bookingRequest.date')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('bookingRequest.pickDate')}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={handleDateSelect}
                          disabled={(date) =>
                            date < new Date()
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex space-x-2">
                <FormField
                  control={form.control}
                  name="startHour"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('bookingRequest.startHour')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('bookingRequest.hour')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>{hour < 10 ? `0${hour}` : hour}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startMinute"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('bookingRequest.startMinute')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('bookingRequest.minute')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['00', '15', '30', '45'].map((minute) => (
                            <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex space-x-2">
                <FormField
                  control={form.control}
                  name="endHour"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('bookingRequest.endHour')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('bookingRequest.hour')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>{hour < 10 ? `0${hour}` : hour}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endMinute"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('bookingRequest.endMinute')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('bookingRequest.minute')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['00', '15', '30', '45'].map((minute) => (
                            <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="button" onClick={() => setStep('details')}>{t('common.next')}</Button>
            </div>
          )}
          {step === 'details' && (
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookingRequest.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('bookingRequest.namePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookingRequest.email')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('bookingRequest.emailPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookingRequest.phone')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('bookingRequest.phonePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookingRequest.notes')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('bookingRequest.notesPlaceholder')}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bookingRequest.paymentStatus')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('bookingRequest.selectPaymentStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_paid">{t('paymentStatus.not_paid')}</SelectItem>
                        <SelectItem value="partly_paid">{t('paymentStatus.partly_paid')}</SelectItem>
                        <SelectItem value="fully_paid">{t('paymentStatus.fully_paid')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="paymentAmount"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t('bookingRequest.paymentAmount')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="pl-8"
                            {...field}
                            disabled={!showPaymentAmount}
                          />
                          <span className="absolute left-2.5 top-2.5 text-gray-500">{currencySymbol}</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hasAttachment"
                  render={({ field }) => (
                    <FormItem className="space-y-0 flex items-center">
                      <FormLabel>{t('bookingRequest.addPaymentAmount')}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={showPaymentAmount}
                          onCheckedChange={setShowPaymentAmount}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FileUploadField 
                onFileSelect={handleFileSelect}
                onFileChange={(file) => console.log('File changed:', file)}
                fileError=""
                setFileError={() => {}}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.submitting') : t('common.submit')}
              </Button>
            </div>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRequestForm;
