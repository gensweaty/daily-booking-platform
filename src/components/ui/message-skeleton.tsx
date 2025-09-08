import { Skeleton } from "@/components/ui/skeleton";

interface MessageSkeletonProps {
  isFirstInGroup?: boolean;
}

export const MessageSkeleton = ({ isFirstInGroup = true }: MessageSkeletonProps) => {
  return (
    <div className={`group relative ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 flex-shrink-0">
          {isFirstInGroup ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : (
            <div className="h-10" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          {isFirstInGroup && (
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          )}

          {/* Message content */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-3/4 max-w-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const MessageListSkeleton = () => {
  return (
    <div className="space-y-4 p-4">
      <MessageSkeleton isFirstInGroup={true} />
      <MessageSkeleton isFirstInGroup={false} />
      <MessageSkeleton isFirstInGroup={false} />
      <MessageSkeleton isFirstInGroup={true} />
      <MessageSkeleton isFirstInGroup={false} />
      <MessageSkeleton isFirstInGroup={true} />
      <MessageSkeleton isFirstInGroup={false} />
      <MessageSkeleton isFirstInGroup={false} />
    </div>
  );
};