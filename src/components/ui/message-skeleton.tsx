import { Skeleton } from "@/components/ui/skeleton";

export const MessageSkeleton = () => {
  return (
    <div className="flex gap-3 p-4">
      {/* Avatar */}
      <Skeleton className="h-10 w-10 rounded-full" />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        
        {/* Message content */}
        <div className="space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
};

export const MessageSkeletonGroup = ({ count = 3 }: { count?: number }) => {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
};

export const LoadingMoreSkeleton = () => {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
        <span>Loading more messages...</span>
      </div>
    </div>
  );
};