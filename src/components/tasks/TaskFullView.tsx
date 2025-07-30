import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { TaskDateInfo } from "./TaskDateInfo";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "../ui/button";
import { AlertCircle, Trash2, Pen, FileText, Calendar, Paperclip, Archive, RefreshCw, History } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Card, CardContent } from "../ui/card";
import { format, parseISO } from "date-fns";

interface TaskFullViewProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  isArchived?: boolean;
}

export const TaskFullView = ({ 
  task, 
  isOpen, 
  onClose, 
  onDelete, 
  onEdit, 
  onArchive, 
  onRestore, 
  isArchived = false 
}: TaskFullViewProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  
  useEffect(() => {
    console.log("TaskFullView - task received:", task);
  }, [task]);

  const { data: files, refetch } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      
      if (error) throw error;
      console.log("Retrieved task files:", data);
      return data;
    },
    enabled: isOpen && !!task.id,
  });

  const handleFileDeleted = () => {
    refetch();
    toast({
      title: t("common.success"),
      description: t("common.fileDeleted"),
    });
  };

  const handleDeleteClick = () => {
    if (onDelete) {
      setIsDeleteConfirmOpen(true);
    }
  };

  const handleArchiveClick = () => {
    if (onArchive) {
      setIsArchiveConfirmOpen(true);
    }
  };

  const handleEditClick = () => {
    if (onEdit) {
      onEdit(task);
      onClose();
    }
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete(task.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    }
  };

  const handleConfirmArchive = () => {
    if (onArchive) {
      onArchive(task.id);
      setIsArchiveConfirmOpen(false);
      onClose();
    }
  };

  const handleRestore = () => {
    if (onRestore) {
      onRestore(task.id);
    }
  };

  // Format dates for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPp');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  const formattedCreatedDate = formatDate(task.created_at);
  const formattedUpdatedDate = task.updated_at ? formatDate(task.updated_at) : formattedCreatedDate;

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[90vw] max-w-[90vw] sm:w-auto sm:max-w-2xl max-h-[80vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6 bg-background border-border text-foreground">
          <DialogHeader className="pb-0 mt-1 sm:mt-3">
            {/* Highlighted Task Title */}
            <div className="p-2 sm:p-4 rounded-lg border border-input bg-muted/50">
              <DialogTitle className="flex items-start gap-2 sm:gap-3 text-left">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-base sm:text-lg font-bold leading-tight break-words">{task.title}</span>
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-3 mt-2 sm:mt-3">
            {/* Description Section */}
            <Card className="border-muted/40 bg-muted/20">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center gap-2 mb-1 sm:mb-3">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">{t("tasks.descriptionLabel")}</h3>
                </div>
                {task.description ? (
                  <div 
                    className="text-xs sm:text-sm text-foreground leading-relaxed prose-sm max-w-none bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground italic bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                    {t("common.noDescription")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Schedule Section */}
            {(task.deadline_at || task.reminder_at) && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-3">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">{t("common.schedule")}</h3>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                    <TaskDateInfo deadline={task.deadline_at} reminderAt={task.reminder_at} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attachments Section */}
            {files && files.length > 0 && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-3">
                    <Paperclip className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">
                      {t("common.attachments")}
                    </h3>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                    <SimpleFileDisplay 
                      files={files} 
                      parentType="task"
                      allowDelete={!isArchived}
                      onFileDeleted={handleFileDeleted}
                      parentId={task.id}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Created and Last Updated indicators - mobile optimized */}
          <div className="px-2 py-1 sm:px-2 sm:py-1.5 rounded-md border border-border bg-card text-card-foreground w-fit">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-1 sm:space-y-0 text-xs text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="w-3 h-3 mr-1" />
                <span className="truncate">{t("common.created")}: {format(parseISO(task.created_at), 'MM/dd/yy')}</span>
              </div>
              <div className="flex items-center">
                <History className="w-3 h-3 mr-1" />
                <span className="truncate">{t("common.lastUpdated")}: {format(parseISO(task.updated_at || task.created_at), 'MM/dd/yy')}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons - mobile optimized */}
          <div className="flex flex-wrap justify-end gap-1 sm:gap-2 pt-2 sm:pt-4 border-t border-muted/20">
            {isArchived ? (
              // Archived view - only show restore button
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleRestore}
                    className="flex items-center gap-1 text-xs px-2 py-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>{t("tasks.restore")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("tasks.restoreTask")}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              // Active task view - show edit, archive, delete buttons
              <>
                {onEdit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleEditClick}
                        className="flex items-center gap-1 text-xs px-2 py-1"
                      >
                        <Pen className="h-3 w-3" />
                        <span className="hidden xs:inline">{t("tasks.editTask")}</span>
                        <span className="xs:hidden">Edit</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("tasks.editTask")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {onArchive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleArchiveClick}
                        className="flex items-center gap-1 text-xs px-2 py-1"
                      >
                        <Archive className="h-3 w-3" />
                        <span className="hidden xs:inline">{t("tasks.archive")}</span>
                        <span className="xs:hidden">Archive</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("tasks.archiveTask")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {onDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleDeleteClick}
                        className="flex items-center gap-1 text-xs px-2 py-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="hidden xs:inline">{t("common.delete")}</span>
                        <span className="xs:hidden">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("common.delete")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="w-[85vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {t("tasks.deleteTaskConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="text-xs">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <AlertDialogContent className="w-[85vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm">
              <Archive className="h-4 w-4 text-amber-600" />
              {t("tasks.archiveTask")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t("tasks.archiveTaskConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="text-xs">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive} className="bg-amber-600 text-white hover:bg-amber-700 text-xs">
              {t("tasks.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};
