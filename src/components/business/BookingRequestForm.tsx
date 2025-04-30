
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useForm, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addHours } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUploadField } from "../shared/FileUploadField";
import { cn } from "@/lib/utils";

interface BookingRequestFormProps {
  businessId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
}

export const BookingRequestForm: React.FC<BookingRequestFormProps> = ({
  businessId,
  onSuccess,
  onCancel,
  className,
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const isGeorgian = language === 'ka';

  const { 
    register, 
    handleSubmit, 
    control, 
    setValue, 
    formState: { errors } 
  } = useForm<BookingFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      title: "",
      description: "",
      startDate: new Date(),
      endDate: addHours(new Date(), 1),
    },
  });

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
  };

  const onSubmit = async (data: BookingFormData) => {
    setIsLoading(true);

    try {
      console.log("Creating booking request:", data);

      // First, create the booking request
      const bookingInsertData = {
        business_id: businessId,
        requester_name: data.name,
        requester_email: data.email,
        requester_phone: data.phone,
        title: data.title,
        description: data.description,
        start_date: data.startDate.toISOString(),
        end_date: data.endDate.toISOString(),
        status: "pending",
      };

      const { data: bookingData, error: bookingError } = await supabase
        .from("booking_requests")
        .insert(bookingInsertData)
        .select()
        .single();

      if (bookingError) {
        throw bookingError;
      }

      // If a file was uploaded, handle file upload and create file record
      if (selectedFile) {
        console.log("Processing file upload for booking request:", selectedFile.name);

        // 1. Upload the file to the booking_attachments bucket
        const filePath = `${bookingData.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        
        const { error: uploadError } = await supabase.storage
          .from("booking_attachments")
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error("Error uploading file:", uploadError);
          throw uploadError;
        }

        console.log("File uploaded successfully:", filePath);
        
        // 2. Create a file record in event_files table
        const fileData = {
          event_id: bookingData.id,
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          source: "booking_request"
        };

        const { error: fileRecordError } = await supabase
          .from("event_files")
          .insert(fileData);

        if (fileRecordError) {
          console.error("Error creating file record:", fileRecordError);
          throw fileRecordError;
        }
        
        console.log("File record created successfully");
      }

      // Notify business owner of new booking request
      try {
        await fetch(
          "https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-booking-request-notification",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              businessId,
              bookingData: {
                ...bookingData,
                hasAttachment: !!selectedFile
              },
            }),
          }
        );
      } catch (notificationError) {
        console.error("Failed to send notification:", notificationError);
        // Continue execution even if notification fails
      }

      // Success notification
      toast({
        title: t("bookings.requestSubmitted"),
        description: t("bookings.requestDescription"),
      });

      // Reset form
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error submitting booking request:", error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description:
          error.message || t("bookings.requestError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <Label htmlFor="name" className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.fullName")} *
        </Label>
        <Input
          id="name"
          {...register("name", { required: t("bookings.nameRequired") as string })}
          placeholder={t("bookings.fullName")}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email" className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.email")} *
        </Label>
        <Input
          id="email"
          type="email"
          {...register("email", { 
            required: t("bookings.emailRequired") as string,
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: t("bookings.invalidEmail") as string,
            }
          })}
          placeholder={t("bookings.email")}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone" className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.phone")}
        </Label>
        <Input
          id="phone"
          {...register("phone")}
          placeholder={t("bookings.phone")}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="title" className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.eventTitle")} *
        </Label>
        <Input
          id="title"
          {...register("title", { required: t("bookings.titleRequired") as string })}
          placeholder={t("bookings.eventTitle")}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.eventDescription")}
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder={t("bookings.eventDescription")}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-1">
        <Label className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.startDate")} *
        </Label>
        <Controller
          name="startDate"
          control={control}
          rules={{ required: t("bookings.startDateRequired") as string }}
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (
                    format(field.value, "PPP p")
                  ) : (
                    <span>{t("bookings.pickDate")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => {
                    if (date) {
                      field.onChange(date);
                      // Update end date to be one hour later
                      setValue("endDate", addHours(date, 1));
                    }
                  }}
                  initialFocus
                />

                <div className="p-3 border-t border-border">
                  <Label htmlFor="startTime">{t("bookings.time")}</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={format(field.value, "HH:mm")}
                    className="mt-1"
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(field.value);
                      newDate.setHours(parseInt(hours, 10));
                      newDate.setMinutes(parseInt(minutes, 10));
                      field.onChange(newDate);
                      
                      // Update end date to be one hour later
                      setValue("endDate", addHours(newDate, 1));
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.startDate && (
          <p className="text-sm text-red-500">{errors.startDate.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label className={cn(isGeorgian && "font-georgian")}>
          {t("bookings.endDate")} *
        </Label>
        <Controller
          name="endDate"
          control={control}
          rules={{ required: t("bookings.endDateRequired") as string }}
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (
                    format(field.value, "PPP p")
                  ) : (
                    <span>{t("bookings.pickDate")}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={(date) => date && field.onChange(date)}
                  initialFocus
                />

                <div className="p-3 border-t border-border">
                  <Label htmlFor="endTime">{t("bookings.time")}</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={format(field.value, "HH:mm")}
                    className="mt-1"
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(field.value);
                      newDate.setHours(parseInt(hours, 10));
                      newDate.setMinutes(parseInt(minutes, 10));
                      field.onChange(newDate);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.endDate && (
          <p className="text-sm text-red-500">{errors.endDate.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <FileUploadField 
          onChange={handleFileChange}
          fileError={fileError}
          setFileError={setFileError}
        />
      </div>

      <div className="flex justify-between pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? t("common.submitting") : t("bookings.submitRequest")}
        </Button>
      </div>
    </form>
  );
};
