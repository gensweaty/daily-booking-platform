
import { Task } from "@/lib/types";
import { Droppable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, Circle, Plus } from "lucide-react";
import { useState } from "react";

interface TaskColumnProps {
  status: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (id: string) => void;
  isPublicBoard?: boolean;
  canEditTask?: (task: Task) => boolean;
  canDeleteTask?: (task: Task) => boolean;
}

export const TaskColumn = ({ status, tasks, onEdit, onView, onDelete, isPublicBoard = false, canEditTask, canDeleteTask }: TaskColumnProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isDragOver, setIsDragOver] = useState(false);
  
  const getColumnStyle = (status: string) => {
    const baseStyle =
      "rounded-2xl border border-border/60 bg-muted/25 dark:bg-card/40 shadow-sm transition-all duration-300";

    if (isDragOver) {
      switch (status) {
        case 'in-progress':
          return `${baseStyle} border-amber-500/50 shadow-lg shadow-amber-500/10`;
        case 'done':
          return `${baseStyle} border-emerald-500/50 shadow-lg shadow-emerald-500/10`;
        default:
          return `${baseStyle} border-primary/50 shadow-lg shadow-primary/10`;
      }
    }

    return baseStyle;
  };

  const getAccent = (status: string) => {
    switch (status) {
      case 'in-progress':
        return { dot: 'bg-amber-500', chip: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' };
      case 'done':
        return { dot: 'bg-emerald-500', chip: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' };
      default:
        return { dot: 'bg-primary', chip: 'bg-primary/12 text-primary' };
    }
  };

  const getColumnIcon = (status: string) => {
    switch (status) {
      case 'todo':
        return <Circle className="h-4 w-4 text-primary" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'done':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getColumnTitle = (status: string) => {
    switch (status) {
      case 'todo':
        return t('tasks.todo');
      case 'in-progress':
        return t('tasks.inProgress');
      case 'done':
        return t('tasks.done');
      default:
        return status;
    }
  };

  const getEmptyStateMessage = (status: string) => {
    switch (status) {
      case 'todo':
        return "No pending tasks";
      case 'in-progress':
        return "No tasks in progress";
      case 'done':
        return "No completed tasks";
      default:
        return "No tasks";
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };


  const emptyStateVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { duration: 0.6, delay: 0.2 }
    }
  };

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`p-3.5 sm:p-4 min-h-[500px] flex flex-col relative overflow-visible ${getColumnStyle(status)}`}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={() => setIsDragOver(false)}
        >
          {/* Animated background pattern */}
          <motion.div
            className="absolute inset-0 opacity-0 pointer-events-none"
            animate={{ 
              opacity: snapshot.isDraggingOver ? 0.15 : 0,
              backgroundPosition: snapshot.isDraggingOver ? "20px 20px" : "0px 0px"
            }}
            transition={{ 
              duration: 0.4
            }}
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 2px, transparent 2px)",
              backgroundSize: "20px 20px"
            }}
          />
          
          {/* Column Header */}
          <motion.div 
            className="flex items-center justify-between mb-4 px-1 pb-3 border-b border-border/50"
            variants={headerVariants}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ 
                  scale: snapshot.isDraggingOver ? 1.15 : 1
                }}
                transition={{ 
                  duration: 0.25
                }}
                className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 ring-1 ring-border/60"
              >
                {getColumnIcon(status)}
              </motion.div>
              
              <h3 className="font-semibold text-foreground flex-shrink-0 text-sm uppercase tracking-wide">
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">
                    <LanguageText>{getColumnTitle(status)}</LanguageText>
                  </GeorgianAuthText>
                ) : (
                  <LanguageText>{getColumnTitle(status)}</LanguageText>
                )}
              </h3>
            </div>
            
            {/* Task Count Badge */}
            <motion.div
              className="flex items-center gap-2"
              key={tasks.length}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 0.4
              }}
            >
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold min-w-[1.75rem] text-center ${
                  tasks.length > 0 ? getAccent(status).chip : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {tasks.length}
              </span>
            </motion.div>
          </motion.div>
          
          {/* Tasks Container */}
          <div className="space-y-3 flex-1 relative">
            {tasks.length > 0 ? (
              tasks.map((task: Task, index: number) => {
                const allowEdit = canEditTask ? canEditTask(task) : true;
                const allowDelete = canDeleteTask ? canDeleteTask(task) : true;
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onEdit={allowEdit ? onEdit : undefined}
                    onView={onView}
                    onDelete={allowDelete ? onDelete : undefined}
                    isPublicBoard={isPublicBoard}
                  />
                );
              })
            ) : (
              <motion.div
                variants={emptyStateVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-14 text-center"
              >
                <motion.div
                  animate={{ 
                    y: [0, -6, 0],
                    opacity: [0.5, 0.9, 0.5]
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity
                  }}
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border/60"
                >
                  <Plus className="h-5 w-5 text-muted-foreground/70" />
                </motion.div>
                
                <motion.p 
                  className="text-muted-foreground text-sm font-medium mb-1"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  {getEmptyStateMessage(status)}
                </motion.p>
                
                {status === 'todo' && (
                  <motion.p 
                    className="text-xs text-muted-foreground/60"
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                  >
                    Drag tasks here or create a new one
                  </motion.p>
                )}
              </motion.div>
            )}
            {provided.placeholder}
            
            {/* Enhanced Drop Zone Indicator */}
            <AnimatePresence>
              {snapshot.isDraggingOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.06, 1]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity
                    }}
                    className="text-primary text-sm font-semibold bg-background/90 px-3.5 py-1.5 rounded-full shadow-md ring-1 ring-primary/20"
                  >
                    Drop here
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Droppable>
  );
};
