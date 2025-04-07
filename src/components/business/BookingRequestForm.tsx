import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { createBookingRequest } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { BookingRequest } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BookingRequestFormProps {
  businessId: string;
  selectedDate: Date;
  startTime?: string;
  endTime?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const BookingRequestForm = ({
  businessId,
  selectedDate,
  startTime,
  endTime,
  open,
  onOpenChange,
  onSuccess
}: BookingRequestFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  const startDateTime = new Date(selectedDate);
  const endDateTime = new Date(selectedDate);
  
  if (startTime) {
    const [hours, minutes] = startTime.split(":").map(Number);
    startDateTime.setHours(hours, minutes, 0, 0);
  }
  
  if (endTime) {
    const [hours, minutes] = endTime.split(":").map(Number);
    endDateTime.setHours(hours, minutes, 0, 0);
  } else {
    endDateTime.setHours(startDateTime.getHours() + 1);
  }

  const form = useForm<BookingRequest>({
    defaultValues: {
      business_id: businessId,
      requester_name: "",
      requester_email: "",
      requester_phone: "",
      title: "",
      description: "",
      start_date: format(startDateTime, "yyyy-MM-dd'T'HH:mm"),
      end_date: format(endDateTime, "yyyy-MM-dd'T'HH:mm"),
      status: "pending",
      user_surname: "",
      user_number: "",
      social_network_link: "",
      event_notes: "",
      payment_status: "not_paid",
      payment_amount: undefined
    }
  });

  useEffect(() => {
    if (open) {
      form.reset({
        business_id: businessId,
        requester_name: "",
        requester_email: "",
        requester_phone: "",
        title: "",
        description: "",
        start_date: format(startDateTime, "yyyy-MM-dd'T'HH:mm"),
        end_date: format(endDateTime, "yyyy-MM-dd'T'HH:mm"),
        status: "pending",
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        payment_status: "not_paid",
        payment_amount: undefined
      });
      setSelectedFile(null);
      setFileError("");
    }
  }, [open, businessId, startDateTime, endDateTime, form]);

  const paymentStatus = form.watch("payment_status");

  const onSubmit = async (data: BookingRequest) => {
    setIsLoading(true);
    
    try {
      let filePath = null;
      let fileName = null;
      
      if (selectedFile) {
        const timestamp = new Date().getTime();
        const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9-_.]/g, "_");
        const path = `booking_files/${timestamp}_${safeFileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from("booking_attachments")
          .upload(path, selectedFile, {
            contentType: selectedFile.type,
            cacheControl: "3600"
          });
          
        if (uploadError) {
          throw new Error(`Error uploading file: ${uploadError.message}`);
        }
        
        filePath = path;
        fileName = selectedFile.name;
        
        const { error: fileRecordError } = await supabase
          .from("booking_files")
          .insert({
            booking_id: null,
            filename: selectedFile.name,
            file_path: path,
            content_type: selectedFile.type,
            size: selectedFile.size
          });
          
        if (fileRecordError) {
          console.error("Error creating file record:", fileRecordError);
        }
      }
      
      const bookingData = {
        ...data,
        payment_amount: data.payment_status !== 'not_paid' ? data.payment_amount : null,
        file_path: filePath,
        filename: fileName
      };
      
      const response = await createBookingRequest(bookingData);
      
      if (selectedFile && filePath) {
        const { error: updateFileError } = await supabase
          .from("booking_files")
          .update({ booking_id: response.id })
          .eq("file_path", filePath);
          
        if (updateFileError) {
          console.error("Error updating file record with booking ID:", updateFileError);
        }
      }
      
      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestSubmittedDesc"),
      });
      
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("bookings.errorSubmitting"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-4">{t("bookings.requestBooking")}</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.fullNameRequired")}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder={t("events.fullName")} 
                      required 
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="user_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.phoneNumber")}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="tel" 
                      placeholder={t("events.phoneNumber")} 
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="social_network_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.socialLinkEmail")}</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="text" 
                      placeholder={t("events.socialLinkEmail")} 
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("events.dateAndTime")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">
                        {t("events.startDateTime")}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="datetime-local"
                          className="bg-background border-input"
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">
                        {t("events.endDateTime")}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="datetime-local"
                          className="bg-background border-input"
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="payment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.paymentStatus")}</FormLabel>
                  <Select 
                    value={field.value} 
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full bg-background border-input">
                        <SelectValue placeholder={t("events.selectPaymentStatus")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background border-input shadow-md">
                      <SelectItem value="not_paid" className="hover:bg-muted focus:bg-muted">
                        {t("crm.notPaid")}
                      </SelectItem>
                      <SelectItem value="partly" className="hover:bg-muted focus:bg-muted">
                        {t("crm.paidPartly")}
                      </SelectItem>
                      <SelectItem value="fully" className="hover:bg-muted focus:bg-muted">
                        {t("crm.paidFully")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {paymentStatus && paymentStatus !== 'not_paid' && (
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="payment_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("events.paymentAmount")} ({language === 'es' ? '€' : '$'})
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder={`${t("events.paymentAmount")} ${language === 'es' ? '(€)' : '($)'}`}
                        className="bg-background border-input"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseFloat(e.target.value) : '';
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="event_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("events.eventNotes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t("events.addEventNotes")}
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("common.uploadFile")}</Label>
            <FileUploadField
              onChange={setSelectedFile}
              fileError={fileError}
              setFileError={setFileError}
              hideLabel={true}
            />
            {fileError && (
              <p className="text-sm text-red-500">{fileError}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="bg-background"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading || !!fileError}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.submitting")}
                </>
              ) : (
                t("common.submit")
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
