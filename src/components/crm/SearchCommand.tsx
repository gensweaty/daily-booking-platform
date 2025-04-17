
import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

interface SearchCommandProps {
  data: any[]
  setFilteredData: (data: any[]) => void
  isLoading?: boolean
}

export const SearchCommand = React.memo(({ data, setFilteredData, isLoading }: SearchCommandProps) => {
  // Use ref for the timeout and the current data to avoid unnecessary re-renders
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const dataRef = React.useRef(data);
  const [searchValue, setSearchValue] = React.useState<string>("");
  
  // Update the ref when data changes
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Search implementation with optimized debouncing  
  const handleSearch = React.useCallback((search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Immediate response for empty search
    if (!search.trim()) {
      setFilteredData(dataRef.current);
      return;
    }
    
    debounceTimeout.current = setTimeout(() => {
      const searchLower = search.toLowerCase();
      const filtered = dataRef.current.filter((item) => {
        return (
          (item.title?.toLowerCase().includes(searchLower)) ||
          (item.user_number?.toLowerCase().includes(searchLower)) ||
          (item.social_network_link?.toLowerCase().includes(searchLower)) ||
          (item.event_notes?.toLowerCase().includes(searchLower)) ||
          (item.payment_status?.toLowerCase().includes(searchLower))
        );
      });
      
      setFilteredData(filtered);
    }, 200);
  }, [setFilteredData]);
  
  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full md:w-[200px] rounded-lg border -mt-4 p-2 space-y-2">
        <Skeleton className="h-9 w-full" />
        <Progress value={75} className="h-1" />
      </div>
    );
  }

  return (
    <Command className="w-full md:w-[200px] rounded-lg border -mt-4">
      <div className="flex items-center px-2">
        <CommandInput
          placeholder="Search..."
          className="h-9 border-0 focus:ring-0 px-0"
          value={searchValue}
          onValueChange={handleSearch}
        />
      </div>
    </Command>
  );
});

SearchCommand.displayName = 'SearchCommand';
