
import { Task } from "@/lib/types";
import { Draggable } from "@hello-pangea/dnd";
import { Pencil, Trash2, Paperclip, Clock, AlertCircle, Eye } from "lucide-react";
import { Button } from "../ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { TaskDateInfo } from "./TaskDateInfo";
import { motion } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";

interface TaskCardProps {
  task: Task;
  index: number;
  onEdit?: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete?: (id: string) => void;
  isPublicBoard?: boolean;
}

export const TaskCard = ({ task, index, onEdit, onView, onDelete, isPublicBoard = false }: TaskCardProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isHovered, setIsHovered] = useState(false);
  
  const { data: files } = useQuery({
    queryKey: ['taskFiles', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('task_id', task.id);
      return data || [];
    },
  });

  const getTaskStyle = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/20 dark:to-transparent';
      case 'done':
        return 'border-l-4 border-l-green-500 bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-900/20 dark:to-transparent';
      default:
        return 'border-l-4 border-l-gray-300 dark:border-l-gray-600 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-800/50 dark:to-transparent';
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

  const iconVariants = {
    idle: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 5, transition: { duration: 0.2 } }
  };

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`p-4 bg-background dark:bg-gray-800 rounded-xl relative overflow-hidden ${getTaskStyle(task.status)} ${
              snapshot.isDragging ? 'shadow-2xl z-50 cursor-grabbing' : 'hover:shadow-lg cursor-grab'
            } transition-shadow duration-200`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Subtle animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0"
              animate={{ opacity: isHovered && !snapshot.isDragging ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className={`flex-1 min-w-0 ${task.status === 'done' ? 'line-through text-gray-500' : 'text-foreground'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {isGeorgian ? (
                        <motion.h3 
                          className="font-semibold cursor-pointer hover:text-primary transition-colors break-words line-clamp-2 leading-tight" 
                          onClick={handleTitleClick}
                          title={task.title}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          <GeorgianAuthText fontWeight="bold">{task.title}</GeorgianAuthText>
                        </motion.h3>
                      ) : (
                        <motion.h3 
                          className="font-semibold cursor-pointer hover:text-primary transition-colors break-words line-clamp-2 leading-tight"
                          onClick={handleTitleClick}
                          title={task.title}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          {task.title}
                        </motion.h3>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getPriorityIndicator()}
                      {files && files.length > 0 && (
                        <motion.div 
                          className="flex items-center text-gray-600"
                        >
                          <Paperclip className="h-4 w-4" />
                          <motion.span 
                            className="text-sm ml-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            {files.length}
                          </motion.span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  
                  {task.description && (
                    <motion.div 
                      className="prose dark:prose-invert max-w-none mt-2 line-clamp-3 text-sm opacity-70 hover:opacity-100 transition-opacity"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                  )}
                  
                  <div className="mt-3">
                    <TaskDateInfo 
                      deadline={task.deadline_at} 
                      reminderAt={task.reminder_at} 
                      compact 
                    />
                  </div>
                </div>
                
                <motion.div 
                  className="flex gap-1 flex-shrink-0 opacity-0"
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  {/* Always show Preview */}
                  <motion.div variants={iconVariants} animate={isHovered ? "hover" : "idle"}>
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
                    <motion.div variants={iconVariants} animate={isHovered ? "hover" : "idle"}>
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

              {/* Delete moved to next line for better balance on all viewports */}
              {onDelete && (
                <motion.div 
                  className="flex justify-end mt-2 opacity-0"
                  animate={{ opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: 0.15 }}
                >
                  <motion.div 
                    variants={iconVariants} 
                    animate={isHovered ? "hover" : "idle"}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task.id);
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
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );
};
