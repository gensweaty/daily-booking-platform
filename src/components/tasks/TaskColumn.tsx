
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
}

export const TaskColumn = ({ status, tasks, onEdit, onView, onDelete }: TaskColumnProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isDragOver, setIsDragOver] = useState(false);
  
  const getColumnStyle = (status: string) => {
    const baseStyle = "border rounded-xl transition-all duration-300";
    
    if (isDragOver) {
      switch (status) {
        case 'in-progress':
          return `${baseStyle} bg-amber-50/70 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 shadow-lg shadow-amber-500/20`;
        case 'done':
          return `${baseStyle} bg-green-50/70 dark:bg-green-900/30 border-green-300 dark:border-green-600 shadow-lg shadow-green-500/20`;
        default:
          return `${baseStyle} bg-blue-50/70 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-lg shadow-blue-500/20`;
      }
    }
    
    switch (status) {
      case 'in-progress':
        return `${baseStyle} bg-amber-50/30 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/50`;
      case 'done':
        return `${baseStyle} bg-green-50/30 dark:bg-green-900/10 border-green-200/50 dark:border-green-700/50`;
      default:
        return `${baseStyle} bg-gray-50/30 dark:bg-gray-900/10 border-gray-200/50 dark:border-gray-700/50`;
    }
  };

  const getColumnIcon = (status: string) => {
    switch (status) {
      case 'todo':
        return <Circle className="h-5 w-5 text-gray-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Circle className="h-5 w-5" />;
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
        duration: 0.4,
        staggerChildren: 0.1
      }
    }
  };

  const taskVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: { 
      opacity: 0, 
      y: -10, 
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const emptyStateVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, delay: 0.2 }
    }
  };

  return (
    <Droppable 
      droppableId={status}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
    >
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`p-4 min-h-[400px] flex flex-col relative overflow-hidden ${getColumnStyle(status)}`}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={() => setIsDragOver(false)}
        >
          {/* Animated background pattern */}
          <motion.div
            className="absolute inset-0 opacity-0"
            animate={{ 
              opacity: isDragOver ? 0.1 : 0,
              backgroundPosition: isDragOver ? "20px 20px" : "0px 0px"
            }}
            transition={{ duration: 0.3 }}
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }}
          />
          
          {/* Column Header */}
          <motion.div 
            className="flex items-center justify-between mb-4 pb-3 border-b border-border/50"
            whileHover={{ y: -1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  rotate: isDragOver ? 180 : 0,
                  scale: isDragOver ? 1.1 : 1
                }}
                transition={{ duration: 0.3 }}
              >
                {getColumnIcon(status)}
              </motion.div>
              
              <h3 className="font-semibold text-foreground flex-shrink-0 text-lg">
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
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <motion.span 
                className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium"
                animate={{ 
                  backgroundColor: tasks.length > 0 ? "hsl(var(--primary) / 0.1)" : "hsl(var(--muted))",
                  color: tasks.length > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
                }}
                transition={{ duration: 0.3 }}
              >
                {tasks.length}
              </motion.span>
            </div>
          </motion.div>
          
          {/* Tasks Container */}
          <div className="space-y-4 flex-1 relative">
            <AnimatePresence mode="popLayout">
              {tasks.length > 0 ? (
                tasks.map((task: Task, index: number) => (
                  <motion.div
                    key={task.id}
                    variants={taskVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className="w-full"
                  >
                    <TaskCard
                      task={task}
                      index={index}
                      onEdit={onEdit}
                      onView={onView}
                      onDelete={onDelete}
                    />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  variants={emptyStateVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <motion.div
                    animate={{ 
                      y: [0, -5, 0],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="mb-4"
                  >
                    <Plus className="h-12 w-12 text-muted-foreground/40" />
                  </motion.div>
                  
                  <p className="text-muted-foreground text-sm">
                    {getEmptyStateMessage(status)}
                  </p>
                  
                  {status === 'todo' && (
                    <motion.p 
                      className="text-xs text-muted-foreground/60 mt-2"
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Drag tasks here or create a new one
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {provided.placeholder}
            
            {/* Drop Zone Indicator */}
            <AnimatePresence>
              {snapshot.isDraggingOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-primary/60 text-sm font-medium"
                  >
                    Drop here
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </Droppable>
  );
};
