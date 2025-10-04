
import { motion } from "framer-motion";
import { Skeleton } from "../ui/skeleton";

export const TaskCardSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-background dark:bg-gray-800 rounded-xl border-l-4 border-l-gray-300 dark:border-l-gray-600"
    >
      <div className="space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        
        {/* Date info */}
        <Skeleton className="h-4 w-1/2" />
        
        {/* Actions */}
        <div className="flex justify-end gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </motion.div>
  );
};
