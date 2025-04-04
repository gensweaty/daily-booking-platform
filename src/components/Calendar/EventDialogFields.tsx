
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { Loader2, Trash } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabase";

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
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paymentStatus?: string;
  setPaymentStatus?: (status: string) => void;
  paymentAmount?: string;
  setPaymentAmount?: (amount: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  eventId?: string;
  onFileDeleted?: (id: string) => void;
  displayedFiles?: any[];
  isBookingRequest?: boolean;
  isExternalRequest?: boolean;
}

export function EventDialogFields({
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
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  eventId,
  onFileDeleted,
  displayedFiles = [],
  isBookingRequest = false,
  isExternalRequest = false
}: EventDialogFieldsProps) {
  const { t, language } = useLanguage();
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      setFileError(t("common.fileSizeError"));
      return;
    }
    
    setSelectedFile(file);
    setFileError("");
  };

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    try {
      setIsLoadingFiles(true);
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event_attachments')
        .remove([filePath]);
      
      if (storageError) throw storageError;
      
      // Delete record
      const { error: dbError } = await supabase
        .from('event_files')
        .delete()
        .eq('id', fileId);
      
      if (dbError) throw dbError;
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">{isExternalRequest ? t("events.bookingTitle") : t("events.eventTitle")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("events.titlePlaceholder")}
          required
        />
      </div>

      <div>
        <Label htmlFor="userSurname">
          {isExternalRequest ? t("events.yourName") : t("events.customerName")}
        </Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          placeholder={t("events.namePlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="userNumber">
          {isExternalRequest ? t("events.yourPhone") : t("events.customerPhone")}
        </Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("events.phonePlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="socialNetworkLink">
          {isExternalRequest ? t("events.yourEmail") : t("events.customerEmail")}
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={isExternalRequest ? t("events.emailPlaceholder") : t("events.socialPlaceholder")}
        />
      </div>

      <div>
        <Label htmlFor="eventNotes">
          {isExternalRequest ? t("events.bookingNotes") : t("events.eventNotes")}
        </Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("events.notesPlaceholder")}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">{t("events.startDateTime")}</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="endDate">{t("events.endDateTime")}</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {!isExternalRequest && setPaymentStatus && setPaymentAmount && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
            <Select
              value={paymentStatus || ""}
              onValueChange={setPaymentStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("events.selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="">{t("events.noneSelected")}</SelectItem>
                  <SelectItem value="paid">{t("events.paid")}</SelectItem>
                  <SelectItem value="pending">{t("events.pending")}</SelectItem>
                  <SelectItem value="cancelled">{t("events.cancelled")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
            <Input
              id="paymentAmount"
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount || ""}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="file">
          {isExternalRequest ? t("events.attachDocument") : t("events.attachFile")}
        </Label>
        <Input
          id="file"
          type="file"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx"
          className="mt-1"
        />
        {fileError && <p className="text-red-500 text-sm mt-1">{fileError}</p>}
        {selectedFile && (
          <p className="text-sm mt-1">
            {t("events.selectedFile")}: {selectedFile.name}
          </p>
        )}
      </div>

      {displayedFiles && displayedFiles.length > 0 && (
        <div>
          <Label>{t("events.attachedFiles")}</Label>
          <div className="mt-2 space-y-2">
            {displayedFiles.map((file) => (
              <div key={file.id} className="flex justify-between items-center p-2 border rounded-md">
                <span className="text-sm truncate flex-1">{file.filename}</span>
                <button
                  type="button"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => handleDeleteFile(file.id, file.file_path)}
                  disabled={isLoadingFiles}
                >
                  {isLoadingFiles ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
