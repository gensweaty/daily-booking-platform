
import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Search } from "lucide-react"

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
    
    // Apply current search filter to the new data
    if (searchValue) {
      handleSearch(searchValue);
    } else {
      setFilteredData(data);
    }
  }, [data, searchValue, setFilteredData]);

  // Real-time elastic-like search implementation
  const handleSearch = (search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Empty search shows all results
    if (!search.trim()) {
      setFilteredData(dataRef.current);
      return;
    }
    
    // Apply immediate search without debounce for better UX
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    
    const filtered = dataRef.current.filter((item) => {
      // Create a combined text from all searchable fields
      const itemText = [
        item.title,
        item.user_number,
        item.social_network_link,
        item.event_notes,
        item.payment_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      
      // More flexible search: match any term for more elastic-like behavior
      return searchTerms.some(term => itemText.includes(term));
    });
    
    console.log(`Search: "${search}" found ${filtered.length} matches from ${dataRef.current.length} items`);
    
    // Update the filtered data to show in the main table
    setFilteredData(filtered);
  };

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
    <div className="w-full md:w-[200px] -mt-4">
      <Command className="rounded-lg border">
        <CommandInput
          placeholder="Search..."
          className="h-9"
          value={searchValue}
          onValueChange={handleSearch}
        />
      </Command>
    </div>
  );
});

SearchCommand.displayName = 'SearchCommand';
