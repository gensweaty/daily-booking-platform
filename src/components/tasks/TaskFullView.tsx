
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Task } from "@/lib/types";
import { SimpleFileDisplay } from "../shared/SimpleFileDisplay";
import { TaskDateInfo } from "./TaskDateInfo";
import { TaskCommentsList } from "./TaskCommentsList";
import { TaskAssigneeDisplay } from "./TaskAssigneeDisplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "../ui/button";
import { AlertCircle, Trash2, Pen, FileText, Calendar, Paperclip, Archive, RefreshCw, History } from "lucide-react";
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
  const { data: profileUsername = "" } = useQuery({
    queryKey: ['profileUsername', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.username || "";
    },
    enabled: isOpen && !!user?.id,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
  
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

  const rawStatus = String(task.status || '').toLowerCase().replace(/[\s_-]/g, '');
  const statusKind: 'done' | 'progress' | 'todo' =
    rawStatus === 'done' ? 'done' : rawStatus.startsWith('in') || rawStatus === 'progress' ? 'progress' : 'todo';
  const statusTheme = {
    done: {
      chip: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25',
      dot: 'bg-emerald-500',
      bar: 'from-emerald-500 via-emerald-500/60 to-transparent',
      wash: 'from-emerald-500/[0.08]',
      label: t('tasks.done'),
    },
    progress: {
      chip: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25',
      dot: 'bg-amber-500',
      bar: 'from-amber-500 via-amber-500/60 to-transparent',
      wash: 'from-amber-500/[0.08]',
      label: t('tasks.inProgress'),
    },
    todo: {
      chip: 'bg-primary/12 text-primary ring-primary/25',
      dot: 'bg-primary',
      bar: 'from-primary via-primary/60 to-transparent',
      wash: 'from-primary/[0.08]',
      label: t('tasks.todo'),
    },
  }[statusKind];

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[92vw] sm:w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 rounded-2xl bg-background border-border/60 text-foreground [word-break:break-word] [overflow-wrap:break-word] min-w-0">
          <DialogHeader className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-4 sm:px-7 lg:px-8 pt-5 sm:pt-6 pb-5 backdrop-blur-md">
            <span aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b ${statusTheme.wash} to-transparent`} />
            <div className="relative flex items-start gap-3 pr-12">
              <span aria-hidden className={`absolute -left-4 sm:-left-7 lg:-left-8 top-0 h-full w-[3px] rounded-full bg-gradient-to-b ${statusTheme.bar}`} />
              <span className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20 shadow-sm">
                <FileText className="h-5 w-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                    {t("tasks.title") || "Task"}
                  </span>
                  <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTheme.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusTheme.dot}`} />
                    {statusTheme.label}
                  </span>
                  {files && files.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
                      <Paperclip className="h-3 w-3" />
                      {files.length}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-left">
                  <span className="text-xl sm:text-3xl font-semibold tracking-tight leading-tight break-words">{task.title}</span>
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 px-4 sm:px-7 lg:px-8 pt-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            {/* Left column */}
            <div className="min-w-0 space-y-4">
              {/* Description Section */}
              <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm transition-colors duration-200 hover:border-primary/30">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t("tasks.descriptionLabel")}
                  </h3>
                </div>
                {task.description ? (
                  <div 
                    className="text-[15px] leading-[1.7] text-foreground/85 prose prose-sm dark:prose-invert max-w-none overflow-x-auto overflow-y-auto max-h-[40vh] sm:max-h-[50vh] break-words [word-break:break-word] [overflow-wrap:break-word] min-w-0 w-full [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-lg [&_h1]:mt-2 [&_h1]:mb-1.5 [&_h2]:text-base [&_h2]:mt-2 [&_h2]:mb-1.5 [&_h3]:text-[15px] [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5"
                    dangerouslySetInnerHTML={{ __html: task.description }}
                  />
                ) : (
                  <p className="text-[15px] text-muted-foreground/80 italic">
                    {t("common.noDescription")}
                  </p>
                )}
              </section>

              {/* Attachments Section */}
              {files && files.length > 0 && (
                <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm transition-colors duration-200 hover:border-primary/30">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                      <Paperclip className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {t("common.attachments")}
                    </h3>
                  </div>
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
                </section>
              )}

              {/* Comments Section */}
              <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm">
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
              </section>
            </div>

            {/* Right column */}
            <aside className="min-w-0 space-y-4 lg:sticky lg:top-[132px] lg:self-start">
              <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t("common.details") || "Task details"}
                  </h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                      {t("tasks.status") || "Status"}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTheme.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusTheme.dot}`} />
                      {statusTheme.label}
                    </span>
                  </div>
                  <Separator className="opacity-60" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                      {t("tasks.assignee") || "Assignee"}
                    </span>
                    {task.assigned_to_id && task.assigned_to_name ? (
                      <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-muted/50 pl-1 pr-3 py-1 ring-1 ring-border/50">
                        <TaskAssigneeDisplay task={task} size="sm" />
                        <span className="truncate text-foreground font-medium">{task.assigned_to_name}</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border/50">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t("common.schedule")}
                  </h3>
                </div>
                {(task.deadline_at || task.reminder_at) && (
                  <div className="mb-4">
                    <TaskDateInfo deadline={task.deadline_at} reminderAt={task.reminder_at} />
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                      <Calendar className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{t("common.created")}</p>
                      <p className="text-sm font-medium text-foreground">{format(parseISO(task.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(parseISO(task.created_at), 'HH:mm')}
                        {task.created_by_name && (
                          <>
                            {' · '}
                            {language === 'ka'
                              ? `${formatAttribution(task.created_by_name, task.created_by_type, task.created_by_ai)}-ს ${t("common.by")}`
                              : `${t("common.by")} ${formatAttribution(task.created_by_name, task.created_by_type, task.created_by_ai)}`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border/50">
                      <History className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{t("common.lastUpdated")}</p>
                      <p className="text-sm font-medium text-foreground">{format(parseISO(task.updated_at || task.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format(parseISO(task.updated_at || task.created_at), 'HH:mm')}
                        {task.last_edited_by_name && task.last_edited_at && (
                          <>
                            {' · '}
                            {language === 'ka'
                              ? `${formatAttribution(task.last_edited_by_name, task.last_edited_by_type, task.last_edited_by_ai)}-ს ${t("common.by")}`
                              : `${t("common.by")} ${formatAttribution(task.last_edited_by_name, task.last_edited_by_type, task.last_edited_by_ai)}`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

            </aside>
          </div>

          {/* Action Buttons - mobile optimized */}
          <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 sm:gap-3 border-t border-border/60 bg-card/40 px-4 sm:px-7 lg:px-8 py-4">
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
