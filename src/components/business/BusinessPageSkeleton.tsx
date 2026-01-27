import { Skeleton } from "@/components/ui/skeleton";

export const BusinessPageSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Tabs skeleton */}
      <div className="flex gap-2 p-1 bg-background/80 border rounded-lg w-fit">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
      </div>

      {/* Form fields skeleton */}
      <div className="space-y-6">
        {/* Business Name */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* URL Slug */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>

        {/* Cover Photo */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>

        {/* Contact Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Submit Button */}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
};

export const BusinessEmptyState = ({ isGeorgian }: { isGeorgian: boolean }) => {
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-background/80 border rounded-lg shadow-sm w-fit">
        <div className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
          {isGeorgian ? "ბიზნეს პროფილი" : "Business Profile"}
        </div>
        <div className="px-4 py-2 rounded-md text-muted-foreground text-sm font-medium">
          {isGeorgian ? "ჯავშნის მოთხოვნები" : "Booking Requests"}
        </div>
      </div>

      {/* Header */}
      <h1 className="text-2xl font-bold">
        {isGeorgian ? "ჩემი ბიზნესი" : "My Business"}
      </h1>

      {/* Empty state message */}
      <div className="text-center py-12 px-4 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/20">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {isGeorgian ? "შექმენით თქვენი ბიზნეს პროფილი" : "Create Your Business Profile"}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isGeorgian 
              ? "შეავსეთ ფორმა ქვემოთ, რომ შექმნათ თქვენი საჯარო ჯავშნის გვერდი და დაიწყოთ ჯავშნების მიღება."
              : "Fill out the form below to create your public booking page and start receiving booking requests."
            }
          </p>
        </div>
      </div>
    </div>
  );
};
