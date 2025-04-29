
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Paperclip, File, X, Download, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { deleteFile, getFileUrl, getEventFiles, getAllEventFiles } from "@/lib/api";
import { FileRecord } from "@/types/files";

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
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  eventId?: string;
  isBookingRequest?: boolean;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
  isLoading?: boolean;
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
  isBookingRequest = false,
  displayedFiles = [],
  onFileDeleted,
  isLoading = false
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  // Load files for this event/booking
  useEffect(() => {
    const loadFiles = async () => {
      if (!eventId) return;
      
      try {
        setLoadingFiles(true);
        console.log("Loading files for event/booking:", eventId);
        
        // Use enhanced file loading function
        const eventFiles = await getAllEventFiles(eventId);
        console.log("Loaded files:", eventFiles);
        
        setFiles(eventFiles);
        
        // Generate public URLs for all files
        const urls: Record<string, string> = {};
        eventFiles.forEach(file => {
          urls[file.id] = getFileUrl(file.file_path);
        });
        setFileUrls(urls);
      } catch (error) {
        console.error("Error loading files:", error);
      } finally {
        setLoadingFiles(false);
      }
    };
    
    if (eventId) {
      loadFiles();
    } else {
      setFiles([]);
      setFileUrls({});
    }
  }, [eventId, displayedFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.size > 50 * 1024 * 1024) {
        setFileError("File size cannot exceed 50MB");
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileDelete = async (file: FileRecord) => {
    if (!onFileDeleted) return;
    
    try {
      setDeleteInProgress(file.id);
      console.log("Deleting file:", file);
      
      const success = await deleteFile(file);
      
      if (success) {
        console.log("File deleted successfully");
        onFileDeleted(file.id);
        setFiles(prev => prev.filter(f => f.id !== file.id));
      } else {
        console.error("Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    } finally {
      setDeleteInProgress(null);
    }
  };

  const openFile = (url: string, filename: string) => {
    window.open(url, '_blank');
  };

  const getAllFiles = () => {
    // Combine displayed files from props and files from state
    if (!files.length) return displayedFiles;
    if (!displayedFiles.length) return files;
    
    const fileMap = new Map<string, any>();
    [...files, ...displayedFiles].forEach(file => {
      if (!fileMap.has(file.id)) {
        fileMap.set(file.id, file);
      }
    });
    
    return Array.from(fileMap.values());
  };

  const getFileUrl = (filePath: string) => {
    return supabase.storage
      .from('event_attachments')
      .getPublicUrl(filePath).data.publicUrl;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.fullName")}
          </Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => {
              setUserSurname(e.target.value);
              setTitle(e.target.value); // Keep title synced with name
            }}
            placeholder={t("events.fullName")}
            className={cn(isGeorgian ? "font-georgian" : "")}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.phoneNumber")}
            </Label>
            <Input
              id="userNumber"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              placeholder={t("events.phoneNumber")}
              className={cn(isGeorgian ? "font-georgian" : "")}
            />
          </div>
          <div>
            <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.email")}
            </Label>
            <Input
              id="socialNetworkLink"
              value={socialNetworkLink}
              onChange={(e) => setSocialNetworkLink(e.target.value)}
              placeholder={t("events.email")}
              type="email"
              className={cn(isGeorgian ? "font-georgian" : "")}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.startDateTime")}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
            />
          </div>
          <div>
            <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.endDateTime")}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.notes")}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={t("events.notesPlaceholder")}
            rows={3}
            className={cn(isGeorgian ? "font-georgian" : "")}
          />
        </div>
        
        {!isBookingRequest && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.paymentStatus")}
              </Label>
              <Select
                value={paymentStatus}
                onValueChange={setPaymentStatus}
              >
                <SelectTrigger id="paymentStatus" className={cn(isGeorgian ? "font-georgian" : "")}>
                  <SelectValue placeholder={t("events.paymentStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                  <SelectItem value="partly_paid">{t("events.partiallyPaid")}</SelectItem>
                  <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.paymentAmount")}
              </Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className={cn(isGeorgian ? "font-georgian" : "")}
              />
            </div>
          </div>
        )}
        
        <div>
          <Label htmlFor="file" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.attachFile")}
          </Label>
          <div className="mt-1 flex items-center">
            <label
              htmlFor="file-upload"
              className="cursor-pointer relative rounded px-3 py-2 border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              <span className={cn(isGeorgian ? "font-georgian" : "")}>
                {selectedFile ? selectedFile.name : t("events.selectFile")}
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            {selectedFile && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {fileError && <p className="text-sm text-red-500 mt-1">{fileError}</p>}
        </div>
        
        <div>
          <h3 className={cn("text-sm font-medium mb-2", isGeorgian ? "font-georgian" : "")}>
            {t("events.attachedFiles")}
          </h3>
          
          {(loadingFiles || isLoading) ? (
            <div className="flex items-center justify-center p-4 border border-dashed rounded-md">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("common.loading")}
              </span>
            </div>
          ) : getAllFiles().length > 0 ? (
            <ul className="space-y-2">
              {getAllFiles().map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded-md bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-center">
                    <File className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm truncate max-w-[200px]">
                      {file.filename}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const url = fileUrls[file.id] || getFileUrl(file.file_path);
                        openFile(url, file.filename);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {onFileDeleted && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFileDelete(file)}
                        disabled={deleteInProgress === file.id}
                      >
                        {deleteInProgress === file.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center p-4 border border-dashed rounded-md">
              <p className={cn("text-sm text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                {t("events.noFilesAttached")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDialogFields;
