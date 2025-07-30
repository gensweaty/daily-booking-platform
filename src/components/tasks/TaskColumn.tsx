
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
    const baseStyle = "border rounded-xl transition-all duration-300 backdrop-blur-sm";
    
    if (isDragOver) {
      switch (status) {
        case 'in-progress':
          return `${baseStyle} bg-gradient-to-br from-amber-50/80 to-amber-100/60 dark:from-amber-900/40 dark:to-amber-800/20 border-amber-300 dark:border-amber-600 shadow-xl shadow-amber-500/30`;
        case 'done':
          return `${baseStyle} bg-gradient-to-br from-green-50/80 to-green-100/60 dark:from-green-900/40 dark:to-green-800/20 border-green-300 dark:border-green-600 shadow-xl shadow-green-500/30`;
        default:
          return `${baseStyle} bg-gradient-to-br from-blue-50/80 to-blue-100/60 dark:from-blue-900/40 dark:to-blue-800/20 border-blue-300 dark:border-blue-600 shadow-xl shadow-blue-500/30`;
      }
    }
    
    switch (status) {
      case 'in-progress':
        return `${baseStyle} bg-gradient-to-br from-amber-50/30 to-amber-100/10 dark:from-amber-900/10 dark:to-amber-800/5 border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/10`;
      case 'done':
        return `${baseStyle} bg-gradient-to-br from-green-50/30 to-green-100/10 dark:from-green-900/10 dark:to-green-800/5 border-green-200/50 dark:border-green-700/30 shadow-lg shadow-green-500/10`;
      default:
        return `${baseStyle} bg-gradient-to-br from-gray-50/30 to-gray-100/10 dark:from-gray-900/10 dark:to-gray-800/5 border-gray-200/50 dark:border-gray-700/30 shadow-lg`;
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

  const taskVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.3 }
    },
    exit: { 
      opacity: 0, 
      y: -10, 
      scale: 0.95,
      transition: { duration: 0.2 }
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
        <motion.div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`p-6 min-h-[500px] flex flex-col relative overflow-hidden ${getColumnStyle(status)}`}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
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
            className="flex items-center justify-between mb-6 pb-4 border-b border-border/40"
            variants={headerVariants}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  rotate: snapshot.isDraggingOver ? 180 : 0,
                  scale: snapshot.isDraggingOver ? 1.2 : 1
                }}
                transition={{ 
                  duration: 0.4
                }}
                className="flex-shrink-0"
              >
                {getColumnIcon(status)}
              </motion.div>
              
              <h3 className="font-bold text-foreground flex-shrink-0 text-lg tracking-tight">
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
              <motion.span 
                className="bg-muted/60 text-muted-foreground px-3 py-1.5 rounded-full text-sm font-bold min-w-[2rem] text-center backdrop-blur-sm"
                animate={{ 
                  backgroundColor: tasks.length > 0 ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.6)",
                  color: tasks.length > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  scale: tasks.length > 0 ? 1.05 : 1
                }}
                transition={{ 
                  duration: 0.3
                }}
              >
                {tasks.length}
              </motion.span>
            </motion.div>
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
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <motion.div
                    animate={{ 
                      y: [0, -8, 0],
                      rotate: [0, 10, -10, 0],
                      opacity: [0.4, 0.8, 0.4]
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity
                    }}
                    className="mb-6"
                  >
                    <Plus className="h-16 w-16 text-muted-foreground/30" />
                  </motion.div>
                  
                  <motion.p 
                    className="text-muted-foreground text-base font-medium mb-2"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    {getEmptyStateMessage(status)}
                  </motion.p>
                  
                  {status === 'todo' && (
                    <motion.p 
                      className="text-sm text-muted-foreground/60"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                    >
                      Drag tasks here or create a new one
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            {provided.placeholder}
            
            {/* Enhanced Drop Zone Indicator */}
            <AnimatePresence>
              {snapshot.isDraggingOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl flex items-center justify-center pointer-events-none backdrop-blur-sm"
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity
                    }}
                    className="text-primary/70 text-lg font-bold bg-background/80 px-4 py-2 rounded-lg shadow-lg"
                  >
                    Drop here ✨
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
