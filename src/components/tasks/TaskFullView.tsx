
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
import { formatAttribution } from "@/lib/metadata";

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
  
  const { data: files, refetch } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!task.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
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

  const rawStatus = String(task.status || '');
  const statusKind: 'done' | 'progress' | 'todo' =
    rawStatus === 'done' ? 'done' : rawStatus.startsWith('in') ? 'progress' : 'todo';

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[92vw] sm:w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 rounded-2xl bg-background border-border/60 text-foreground [word-break:break-word] [overflow-wrap:break-word] min-w-0">
          <DialogHeader className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 -mt-3 sm:-mt-6 lg:-mt-8 px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 lg:pt-8 pb-3 bg-background/95 backdrop-blur-md">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 sm:p-5 pr-14 shadow-sm">
              <span
                aria-hidden
                className={`absolute left-0 top-0 h-full w-[3px] ${
                  statusKind === 'done' ? 'bg-emerald-500' : statusKind === 'progress' ? 'bg-amber-500' : 'bg-primary'
                }`}
              />
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${
                  statusKind === 'done'
                    ? 'from-emerald-500/[0.07]'
                    : statusKind === 'progress'
                      ? 'from-amber-500/[0.07]'
                      : 'from-primary/[0.07]'
                } to-transparent`}
              />
              <div className="relative flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                  <FileText className="h-[18px] w-[18px] text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                      statusKind === 'done'
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25'
                        : statusKind === 'progress'
                          ? 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25'
                          : 'bg-primary/12 text-primary ring-primary/25'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        statusKind === 'done' ? 'bg-emerald-500' : statusKind === 'progress' ? 'bg-amber-500' : 'bg-primary'
                      }`} />
                      {statusKind === 'done' ? t('tasks.done') : statusKind === 'progress' ? t('tasks.inProgress') : t('tasks.todo')}
                    </span>
                    {files && files.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                        <Paperclip className="h-3 w-3" />
                        {files.length}
                      </span>
                    )}
                    {task.assigned_to_id && task.assigned_to_name && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 pl-0.5 pr-2.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                        <TaskAssigneeDisplay task={task} size="sm" />
                        {task.assigned_to_name}
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-left">
                    <span className="text-lg sm:text-2xl font-semibold tracking-tight leading-snug break-words">{task.title}</span>
                  </DialogTitle>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 mt-1">
            {/* Description Section */}
            <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </span>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("tasks.descriptionLabel")}</h3>
              </div>
              {task.description ? (
                <div 
                  className="text-[15px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none overflow-x-auto overflow-y-auto max-h-[40vh] sm:max-h-[50vh] break-words [word-break:break-word] [overflow-wrap:break-word] min-w-0 w-full [&_h1]:text-lg [&_h1]:mt-2 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:mt-2 [&_h2]:mb-1.5 [&_h3]:text-[15px] [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              ) : (
                <p className="text-[15px] text-muted-foreground italic">
                  {t("common.noDescription")}
                </p>
              )}
            </section>

            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 items-stretch">
              {/* Schedule Section */}
              {(task.deadline_at || task.reminder_at) && (
                <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.schedule")}</h3>
                  </div>
                  <TaskDateInfo deadline={task.deadline_at} reminderAt={task.reminder_at} />
                </section>
              )}

              {/* Assignment Section */}
              <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</h3>
                </div>
                {task.assigned_to_id && task.assigned_to_name ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-muted/50 pl-1 pr-3 py-1 text-sm ring-1 ring-border/50">
                    <TaskAssigneeDisplay task={task} size="sm" />
                    <span className="text-foreground font-medium">{task.assigned_to_name}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center rounded-full bg-muted/40 px-3 py-1 text-sm text-muted-foreground ring-1 ring-border/50">
                    Unassigned
                  </div>
                )}
              </section>
            </div>

            {/* Attachments Section */}
            {files && files.length > 0 && (
              <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("common.attachments")}
                  </h3>
                </div>
                <div>
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
              </section>
            )}
          </div>

          {/* Created and Last Updated indicators - mobile optimized */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border border-border/50 bg-muted/25 px-3 py-1.5 text-muted-foreground">
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
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
                    className="w-full sm:w-auto justify-center flex items-center gap-1.5 sm:gap-2 text-sm px-4 h-10 font-medium border border-border/50 hover:border-primary/30 transition-all"
                  >
                    <Pen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                        className="w-full sm:w-auto justify-center flex items-center gap-1.5 sm:gap-2 text-sm px-4 h-10 font-medium border border-border/50 hover:border-amber-500/30 transition-all"
                      >
                        <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                        className="w-full sm:w-auto justify-center flex items-center gap-1.5 sm:gap-2 text-sm px-4 h-10 font-medium shadow-sm transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
          
          {/* Delete Confirmation Dialog - Rendered inside Dialog for proper z-index */}
          <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <AlertDialogContent className="w-[85vw] max-w-md sm:w-auto sm:max-w-lg">
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

          {/* Archive Confirmation Dialog - Rendered inside Dialog for proper z-index */}
          <AlertDialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
            <AlertDialogContent className="w-[85vw] max-w-md sm:w-auto sm:max-w-lg">
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
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
