
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { FileDisplay } from "../shared/FileDisplay";
import { TaskDateInfo } from "./TaskDateInfo";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "../ui/button";
import { AlertCircle, Trash2, Pen, FileText, Calendar, Paperclip, Archive, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Card, CardContent } from "../ui/card";

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

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-background border-border text-foreground sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-start gap-3 text-left">
              <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-xl font-bold leading-tight">{task.title}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Description Section */}
            <Card className="border-muted/40 bg-muted/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-muted-foreground">{t("tasks.descriptionLabel")}</h3>
                </div>
                {task.description ? (
                  <div 
                    className="text-sm text-foreground leading-relaxed prose-sm max-w-none bg-muted/30 rounded-md p-3 border border-muted/40"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic bg-muted/30 rounded-md p-3 border border-muted/40">
                    {t("common.noDescription")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Schedule Section */}
            {(task.deadline_at || task.reminder_at) && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">Schedule</h3>
                  </div>
                  <div className="bg-muted/30 rounded-md p-3 border border-muted/40">
                    <TaskDateInfo deadline={task.deadline_at} reminderAt={task.reminder_at} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attachments Section */}
            {files && files.length > 0 && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {t("common.attachments")}
                    </h3>
                  </div>
                  <div className="bg-muted/30 rounded-md p-3 border border-muted/40">
                    <FileDisplay 
                      files={files} 
                      bucketName="event_attachments" 
                      allowDelete={!isArchived}
                      onFileDeleted={handleFileDeleted}
                      parentId={task.id}
                      parentType="task"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-muted/20">
            {isArchived ? (
              // Archived view - only show restore button
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleRestore}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
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
                        className="flex items-center gap-2"
                      >
                        <Pen className="h-4 w-4" />
                        <span>{t("tasks.editTask")}</span>
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
                        className="flex items-center gap-2"
                      >
                        <Archive className="h-4 w-4" />
                        <span>{t("tasks.archive")}</span>
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
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{t("common.delete")}</span>
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
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("tasks.deleteTaskConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-600" />
              {t("tasks.archiveTask")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.archiveTaskConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive} className="bg-amber-600 text-white hover:bg-amber-700">
              {t("tasks.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};
