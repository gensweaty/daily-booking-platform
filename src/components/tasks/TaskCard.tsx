import { Task } from "@/lib/types";
import { Draggable } from "@hello-pangea/dnd";
import { Pencil, Trash2, Paperclip, Clock, AlertCircle, Eye } from "lucide-react";
import { Button } from "../ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { TaskDateInfo } from "./TaskDateInfo";
import { TaskAssigneeDisplay } from "./TaskAssigneeDisplay";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit?: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete?: (id: string) => void;
  isPublicBoard?: boolean;
}

const TaskCardInner = ({ task, index, onEdit, onView, onDelete, isPublicBoard = false }: TaskCardProps) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const { data: files } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      return data || [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const statusMeta = (status: string) => {
    const normalized = String(status || '').toLowerCase().replace(/[\s_-]/g, '');
    switch (normalized) {
      case 'inprogress':
      case 'progress':
        return {
          label: t('tasks.inProgress'),
          chip: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25',
          dot: 'bg-amber-500',
          accent: 'from-amber-500/70 via-amber-500/20 to-transparent',
        };
      case 'done':
        return {
          label: t('tasks.done'),
          chip: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25',
          dot: 'bg-emerald-500',
          accent: 'from-emerald-500/70 via-emerald-500/20 to-transparent',
        };
      default:
        return {
          label: t('tasks.todo'),
          chip: 'bg-primary/12 text-primary ring-primary/25',
          dot: 'bg-primary',
          accent: 'from-primary/70 via-primary/20 to-transparent',
        };
    }
  };

  const getPriorityIndicator = () => {
    const isOverdue = task.deadline_at && new Date(task.deadline_at) < new Date();
    const isDueSoon = task.deadline_at && 
      new Date(task.deadline_at) < new Date(Date.now() + 24 * 60 * 60 * 1000) && 
      new Date(task.deadline_at) > new Date();

    if (isOverdue) {
      return (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center text-red-500"
        >
          <AlertCircle className="h-3 w-3" />
        </motion.div>
      );
    }
    
    if (isDueSoon) {
      return (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex items-center text-amber-500"
        >
          <Clock className="h-3 w-3" />
        </motion.div>
      );
    }
    
    return null;
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(task);
  };

  const handleDescriptionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(task);
  };

  const iconVariants = {
    idle: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 5, transition: { duration: 0.2 } }
  };

  const getStyle = (style: any, snapshot: any) => {
    const baseStyle = {
      ...style,
      cursor: snapshot.isDragging ? 'grabbing' : 'grab'
    };
    
    if (!snapshot.isDropAnimating) {
      return baseStyle;
    }
    
    return {
      ...baseStyle,
      transitionDuration: '0.001ms', // Instant drop for better mobile performance
    };
  };

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => {
        const meta = statusMeta(task.status);
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            data-is-dragging={snapshot.isDragging}
            className={`group p-4 bg-card rounded-2xl relative overflow-hidden border border-border/70 hover:border-primary/40 ${
              snapshot.isDragging
                ? 'shadow-2xl shadow-primary/20 z-50 opacity-95 scale-[1.03] border-primary/50'
                : 'shadow-sm hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5'
            } transition-all duration-200`}
            style={getStyle(provided.draggableProps.style, snapshot)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Status accent line */}
            <span
              aria-hidden
              className={`absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b ${meta.accent}`}
            />
            {/* Subtle hover glow */}
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] to-transparent opacity-0"
              animate={{ opacity: isHovered && !snapshot.isDragging ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            />
            
            <div className="relative z-10">
              {/* Top meta row: status chip + indicators */}
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {getPriorityIndicator()}
                  {files && files.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      {files.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-start gap-2 mb-3">
                <div className={`flex-1 min-w-0 ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {isGeorgian ? (
                        <motion.h3 
                          className="text-[15px] font-semibold cursor-pointer hover:text-primary transition-colors break-words line-clamp-2 leading-snug tracking-tight"
                          onClick={handleTitleClick}
                          title={task.title}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          <GeorgianAuthText fontWeight="bold">{task.title}</GeorgianAuthText>
                        </motion.h3>
                      ) : (
                        <motion.h3 
                          className="text-[15px] font-semibold cursor-pointer hover:text-primary transition-colors break-words line-clamp-2 leading-snug tracking-tight"
                          onClick={handleTitleClick}
                          title={task.title}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          {task.title}
                        </motion.h3>
                      )}
                    </div>
                  </div>
                  
                  {task.description && (
                    <motion.div 
                      className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground hover:text-foreground/80 transition-colors cursor-pointer [&_*]:!m-0 [&_*]:!text-[13px] [&_*]:!font-normal [&_*]:!leading-relaxed"
                      onClick={handleDescriptionClick}
                      role="button"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                  )}
                  
                  <div className="mt-2.5">
                    <TaskDateInfo 
                      deadline={task.deadline_at} 
                      reminderAt={task.reminder_at} 
                      compact 
                    />
                  </div>
                </div>
                
                <motion.div 
                  className="flex gap-0.5 flex-shrink-0 opacity-0 rounded-lg bg-background/70 backdrop-blur-sm p-0.5 ring-1 ring-border/60"
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  {/* Always show Preview */}
                  <motion.div variants={iconVariants} initial="idle" whileHover="hover">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(task);
                      }}
                      className="text-foreground hover:text-primary hover:bg-primary/10 h-8 w-8 transition-all duration-200"
                      title="Preview task"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </motion.div>

                  {/* Conditionally show Edit */}
                  {onEdit && (
                    <motion.div variants={iconVariants} initial="idle" whileHover="hover">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(task);
                        }}
                        className="text-foreground hover:text-primary hover:bg-primary/10 h-8 w-8 transition-all duration-200"
                        title="Edit task"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>

              </div>

              {/* Bottom row with assignee and delete button on the right */}
              <div className="flex justify-end items-center gap-2 mt-3 pt-2.5 border-t border-border/50">
                {/* Assignee avatar - always visible */}
                <div className="flex-shrink-0">
                  <TaskAssigneeDisplay task={task} size="sm" />
                </div>
                
                {/* Delete button - shows on hover */}
                {onDelete && (
                  <motion.div 
                    className="opacity-0"
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.2, delay: 0.15 }}
                  >
                    <motion.div 
                      variants={iconVariants} 
                      initial="idle" whileHover="hover"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="text-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 transition-all duration-200"
                        title="Delete task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : (
          <>
            {child}
            {/* Delete Confirmation Dialog */}
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
                  <AlertDialogAction 
                    onClick={() => {
                      if (onDelete) {
                        onDelete(task.id);
                      }
                      setIsDeleteConfirmOpen(false);
                    }} 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm"
                  >
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        );
      }}
    </Draggable>
  );
};

export const TaskCard = memo(TaskCardInner, (prev, next) =>
  prev.task === next.task &&
  prev.index === next.index &&
  prev.onEdit === next.onEdit &&
  prev.onView === next.onView &&
  prev.onDelete === next.onDelete &&
  prev.isPublicBoard === next.isPublicBoard
);
