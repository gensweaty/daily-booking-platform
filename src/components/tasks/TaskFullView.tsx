
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { TaskDateInfo } from "./TaskDateInfo";
import { TaskCommentsList } from "./TaskCommentsList";
import { TaskAssigneeDisplay } from "./TaskAssigneeDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "../ui/button";
import { AlertCircle, Trash2, Pen, FileText, Calendar, Paperclip, Archive, RefreshCw, History, UserCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
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
  // External user props for public boards
  externalUserName?: string;
  externalUserEmail?: string;
}

export const TaskFullView = ({ 
  task, 
  isOpen, 
  onClose, 
  onDelete, 
  onEdit, 
  onArchive, 
  onRestore, 
  isArchived = false,
  externalUserName,
  externalUserEmail
}: TaskFullViewProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string>("");
  
  useEffect(() => {
    const fetchProfileUsername = async () => {
      try {
        if (!user?.id) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.error('Error fetching profile username:', error);
          return;
        }
        if (data?.username) setProfileUsername(data.username);
      } catch (err) {
        console.error('Exception fetching profile username:', err);
      }
    };
    fetchProfileUsername();
  }, [user?.id]);
  
  useEffect(() => {
    console.log("TaskFullView - task received:", task);
    console.log("TaskFullView - permission props:", {
      hasOnEdit: !!onEdit,
      hasOnDelete: !!onDelete,
      hasOnArchive: !!onArchive,
      isArchived,
      taskId: task.id,
      createdByType: task.created_by_type,
      createdByName: task.created_by_name,
      createdByAI: task.created_by_ai
    });
  }, [task, onEdit, onDelete, onArchive, isArchived]);

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

  const formatAttribution = (name?: string, type?: string, isAI?: boolean) => {
    if (!name) return undefined;
    
    const isSub = type === 'sub_user';
    
    // Show (AI) only for sub-user AI creations
    return (isAI && isSub) ? `${name} (AI)` : name;
  };

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[80vh] sm:max-h-[90vh] overflow-y-auto p-2 sm:p-6 bg-background border-border text-foreground z-[9998]">
          <DialogHeader className="pb-0 mt-1 sm:mt-3">
            {/* Highlighted Task Title */}
            <div className="p-2 sm:p-4 rounded-lg border border-input bg-muted/50">
              <DialogTitle className="flex items-start gap-2 sm:gap-3 text-left">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-base sm:text-xl font-bold leading-tight break-words">{task.title}</span>
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-2 sm:space-y-4 mt-2 sm:mt-4">
            {/* Description Section */}
            <Card className="border-muted/40 bg-muted/20">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <h3 className="text-sm sm:text-base font-medium text-muted-foreground">{t("tasks.descriptionLabel")}</h3>
                </div>
                {task.description ? (
                  <div 
                    className="text-base sm:text-lg text-foreground leading-relaxed prose-sm max-w-none bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-base sm:text-lg text-muted-foreground italic bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                    {t("common.noDescription")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Schedule Section */}
            {(task.deadline_at || task.reminder_at) && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">{t("common.schedule")}</h3>
                  </div>
                  <div className="bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                    <TaskDateInfo deadline={task.deadline_at} reminderAt={task.reminder_at} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assignment Section */}
            <Card className="border-muted/40 bg-muted/20">
              <CardContent className="p-2 sm:p-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  <h3 className="text-xs sm:text-sm font-medium text-muted-foreground">Assigned To</h3>
                </div>
                <div className="bg-muted/30 rounded-md p-2 sm:p-3 border border-muted/40">
                  {task.assigned_to_id && task.assigned_to_name ? (
                    <div className="flex items-center gap-2 text-sm">
                      <TaskAssigneeDisplay task={task} size="md" />
                      <span className="text-foreground">{task.assigned_to_name}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Unassigned
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Attachments Section */}
            {files && files.length > 0 && (
              <Card className="border-muted/40 bg-muted/20">
                <CardContent className="p-2 sm:p-4">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
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
                      currentUserName={externalUserName || profileUsername || user?.email}
                      currentUserType={externalUserName ? 'sub_user' : 'admin'}
                      isSubUser={!!externalUserName}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Created and Last Updated indicators - mobile optimized */}
          <div className="px-2 py-1 sm:px-3 sm:py-2 rounded-md border border-border bg-card text-card-foreground w-fit">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="truncate">
                  {t("common.created")} {format(parseISO(task.created_at), 'MM/dd/yy HH:mm')}
                   {task.created_by_name && (
                      <span className="ml-1">
                        {language === 'ka' 
                          ? `${formatAttribution(task.created_by_name, task.created_by_type, task.created_by_ai)}-ს ${t("common.by")}` 
                          : `${t("common.by")} ${formatAttribution(task.created_by_name, task.created_by_type, task.created_by_ai)}`}
                      </span>
                    )}
                </span>
              </div>
              <div className="flex items-center">
                <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="truncate">
                  {t("common.lastUpdated")} {format(parseISO(task.updated_at || task.created_at), 'MM/dd/yy HH:mm')}
                   {task.last_edited_by_name && task.last_edited_at && (
                      <span className="ml-1">
                        {language === 'ka' 
                          ? `${formatAttribution(task.last_edited_by_name, task.last_edited_by_type, task.last_edited_by_ai)}-ს ${t("common.by")}` 
                          : `${t("common.by")} ${formatAttribution(task.last_edited_by_name, task.last_edited_by_type, task.last_edited_by_ai)}`}
                      </span>
                    )}
                </span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="mt-2">
            <Separator className="mb-2" />
            <div className="px-1">
              <TaskCommentsList 
                taskId={task.id} 
                isEditing={!isArchived}
                username={profileUsername || (user?.user_metadata?.full_name as string) || user?.email || 'Admin'}
                externalUserName={externalUserName}
                externalUserEmail={externalUserEmail}
                isExternal={!!externalUserName}
                userId={user?.id}
                taskCreatorName={task.created_by_name}
              />
            </div>
          </div>

          {/* Action Buttons - mobile optimized */}
          <div className="flex flex-wrap justify-end gap-1 sm:gap-3 pt-2 sm:pt-4 border-t border-muted/20">
            {isArchived ? (
              // Archived view - only show restore button
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleRestore}
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                  >
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
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
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleEditClick}
                    className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                  >
                    <Pen className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{t("tasks.editTask")}</span>
                  </Button>
                )}
                
                {onArchive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleArchiveClick}
                        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                      >
                        <Archive className="h-3 w-3 sm:h-4 sm:w-4" />
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
                        className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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
        <AlertDialogContent className="w-[85vw] max-w-md sm:w-auto sm:max-w-lg z-[10001]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              {t("tasks.deleteTaskConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="text-xs sm:text-sm">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <AlertDialogContent className="w-[85vw] max-w-md sm:w-auto sm:max-w-lg z-[10001]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              {t("tasks.archiveTask")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {t("tasks.archiveTaskConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="text-xs sm:text-sm">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive} className="bg-amber-600 text-white hover:bg-amber-700 text-xs sm:text-sm">
              {t("tasks.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};
