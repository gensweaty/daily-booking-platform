
import React from "react";
import { Spinner } from "@/components/ui/spinner";

interface LoadingProps {
  fullScreen?: boolean;
  className?: string;
}

export const Loading = ({ fullScreen = true, className = "" }: LoadingProps) => {
  const containerClasses = fullScreen
    ? "flex items-center justify-center h-screen w-full"
    : "flex items-center justify-center p-8 w-full";

  return (
    <div className={`${containerClasses} ${className}`}>
      <Spinner size="lg" />
    </div>
  );
};
