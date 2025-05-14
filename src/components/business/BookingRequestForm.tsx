
import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";

interface BookingRequestFormProps {
  businessId: string | undefined;
  selectedDate?: Date;
  startTime?: string;
  endTime?: string;
  onSuccess?: () => void;
  isExternalBooking?: boolean;
}

export const BookingRequestForm = ({ 
  businessId, 
  selectedDate, 
  startTime: initialStartTime, 
  endTime: initialEndTime, 
  onSuccess,
  isExternalBooking
}: BookingRequestFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingDate, setBookingDate] = useState<Date | undefined>(selectedDate || new Date());
  const [startTime, setStartTime] = useState(initialStartTime || "");
  const [endTime, setEndTime] = useState(initialEndTime || "");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"not_paid" | "partly_paid" | "fully_paid">("not_paid");
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setName(user?.user_metadata?.name || "");
        setEmail(user?.email || "");
      }
    };

    fetchUserProfile();
  }, [user]);

  const createBookingRequestMutation = useMutation({
    mutationFn: async () => {
      if (!businessId) {
        throw new Error("Business ID is required");
      }

      if (!bookingDate) {
        throw new Error("Booking date is required");
      }

      if (!startTime || !endTime) {
        throw new Error("Start and end times are required");
      }

      const startDateTime = new Date(bookingDate);
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      startDateTime.setHours(startHours, startMinutes, 0, 0);

      const endDateTime = new Date(bookingDate);
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error("Invalid date or time");
      }

      if (endDateTime <= startDateTime) {
        throw new Error("End time must be after start time");
      }

      setUploading(true);

      let filePath: string | null = null;
      let filename: string | null = null;
      let contentType: string | null = null;
      let size: number | null = null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        filePath = `${businessId}/${crypto.randomUUID()}.${fileExt}`;
        filename = selectedFile.name;
        contentType = selectedFile.type;
        size = selectedFile.size;

        const { error: uploadError } = await supabase.storage
          .from("booking_attachments")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setUploading(false);
          throw uploadError;
        }
      }

      const { data: response, error } = await supabase
        .from("booking_requests")
        .insert([
          {
            business_id: businessId,
            title: t("bookings.newBookingRequest"),
            requester_name: name,
            requester_email: email,
            requester_phone: phone,
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
            description: description,
            filename: filename,
            file_path: filePath,
            content_type: contentType,
            size: size,
            status: "pending",
            terms_accepted: termsAccepted,
            gdpr_accepted: gdprAccepted,
            payment_status: paymentStatus,
            payment_amount: paymentAmount,
            language: language,
          },
        ])
        .select()
        .single();

      if (error) {
        setUploading(false);
        throw error;
      }

      return response;
    },
    onSuccess: (response) => {
      if (response) {
        // Clear form
        setUploading(false);
        setName("");
        setEmail("");
        setPhone("");
        setBookingDate(new Date());
        setStartTime("");
        setEndTime("");
        setDescription("");
        setSelectedFile(null);
        toast.booking.submitted();
        onSuccess?.();
      }
    },
    onError: (error: any) => {
      setUploading(false);
      toast.error({
        description:
          error.message || t("bookings.submitBookingRequestError"),
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted || !gdprAccepted) {
      toast.error({
        description: t("bookings.acceptTermsAndGdpr"),
      });
      return;
    }

    createBookingRequestMutation.mutate();
  };

  const isValidTime = (time: string): boolean => {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("bookings.bookingRequestForm")}</CardTitle>
        <CardDescription>
          {t("bookings.submitBookingRequestDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">{t("common.name")}</Label>
          <Input
            id="name"
            type="text"
            placeholder={t("common.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("common.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("common.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("common.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            placeholder={t("common.phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("bookings.bookingDate")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !bookingDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {bookingDate ? (
                  format(bookingDate, "PPP")
                ) : (
                  <span>{t("bookings.pickDate")}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={bookingDate}
                onSelect={setBookingDate}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="startTime">{t("bookings.startTime")}</Label>
            <Input
              type="time"
              id="startTime"
              placeholder={t("bookings.startTimePlaceholder")}
              value={startTime}
              onChange={(e) => {
                if (isValidTime(e.target.value)) {
                  setStartTime(e.target.value);
                } else {
                  toast.error({
                    description: t("bookings.invalidTimeFormat"),
                  });
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endTime">{t("bookings.endTime")}</Label>
            <Input
              type="time"
              id="endTime"
              placeholder={t("bookings.endTimePlaceholder")}
              value={endTime}
              onChange={(e) => {
                if (isValidTime(e.target.value)) {
                  setEndTime(e.target.value);
                } else {
                  toast.error({
                    description: t("bookings.invalidTimeFormat"),
                  });
                }
              }}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">{t("bookings.description")}</Label>
          <Textarea
            id="description"
            placeholder={t("bookings.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <FileUploadField
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
        />

        <Separator />

        <div className="grid gap-2">
          <Label htmlFor="paymentStatus">{t("bookings.paymentStatus")}</Label>
          <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as "not_paid" | "partly_paid" | "fully_paid")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("bookings.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">{t("bookings.notPaid")}</SelectItem>
              <SelectItem value="partly_paid">{t("bookings.partlyPaid")}</SelectItem>
              <SelectItem value="fully_paid">{t("bookings.fullyPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentAmount">{t("bookings.paymentAmount")}</Label>
          <Input
            id="paymentAmount"
            type="number"
            placeholder={t("bookings.paymentAmountPlaceholder")}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(Number(e.target.value))}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(!!checked)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="terms">
              {t("bookings.acceptTerms")}{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {t("common.termsAndConditions")}
              </a>
            </Label>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="gdpr"
            checked={gdprAccepted}
            onCheckedChange={(checked) => setGdprAccepted(!!checked)}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="gdpr">
              {t("bookings.acceptGdpr")}{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {t("common.privacyPolicy")}
              </a>
            </Label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={createBookingRequestMutation.isPending || uploading}
        >
          {createBookingRequestMutation.isPending || uploading
            ? t("common.submitting")
            : t("bookings.submitBookingRequest")}
        </Button>
      </CardFooter>
    </Card>
  );
};
