
import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"

interface SearchCommandProps {
  data: any[]
  setFilteredData: (data: any[]) => void
}

export const SearchCommand = React.memo(({ data, setFilteredData }: SearchCommandProps) => {
  // Use ref for the timeout and the current data to avoid unnecessary re-renders
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const currentDataRef = React.useRef(data);
  const [searchValue, setSearchValue] = React.useState<string>("");
  
  // Update the ref when data changes
  React.useEffect(() => {
    currentDataRef.current = data;
  }, [data]);

  // Search implementation with optimized debouncing  
  const handleSearch = React.useCallback((search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Immediate response for empty search
    if (!search.trim()) {
      setFilteredData(currentDataRef.current);
      return;
    }
    
    debounceTimeout.current = setTimeout(() => {
      const searchLower = search.toLowerCase();
      const filtered = currentDataRef.current.filter((item) => {
        return (
          (item.title?.toLowerCase().includes(searchLower)) ||
          (item.user_number?.toLowerCase().includes(searchLower)) ||
          (item.social_network_link?.toLowerCase().includes(searchLower)) ||
          (item.event_notes?.toLowerCase().includes(searchLower)) ||
          (item.payment_status?.toLowerCase().includes(searchLower))
        );
      });
      
      setFilteredData(filtered);
    }, 200); // Slight increase in debounce time to reduce processing frequency
  }, [setFilteredData]);
  
  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

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
