
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

  // Enhanced search implementation with improved matching
  const handleSearch = React.useCallback((search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Apply immediate search for any input with more thorough filtering
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    
    const filtered = !searchTerms.length 
      ? dataRef.current 
      : dataRef.current.filter((item) => {
          // Create a combined text from all searchable fields
          const itemText = [
            item.title,
            item.user_number,
            item.social_network_link,
            item.event_notes,
            item.payment_status,
            // Add any other fields that might contain relevant search data
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          
          // Check if ALL search terms are found in any of the fields
          return searchTerms.every(term => itemText.includes(term));
        });
    
    console.log(`Search: "${search}" found ${filtered.length} matches from ${dataRef.current.length} items`);
    setFilteredData(filtered);
    
    // Still keep the debounce for potential expensive operations in the future
    debounceTimeout.current = setTimeout(() => {
      // This could be used for analytics or other side effects
    }, 100);
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
