
import * as React from "react"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
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
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  
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
  const handleSearch = React.useCallback((search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Empty search shows all results
    if (!search.trim()) {
      setFilteredData(dataRef.current);
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    
    // Apply immediate search with elastic-like functionality
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    
    const filtered = dataRef.current.filter((item) => {
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
      
      // More flexible search: match any term for more elastic-like behavior
      return searchTerms.some(term => itemText.includes(term));
    });
    
    console.log(`Search: "${search}" found ${filtered.length} matches from ${dataRef.current.length} items`);
    
    // Update both the filtered data and search results
    setFilteredData(filtered);
    setSearchResults(filtered.slice(0, 5)); // Top 5 results for dropdown
    setShowResults(true);
    
  }, [setFilteredData]);
  
  // Handle item selection from dropdown
  const handleSelectItem = React.useCallback((item: any) => {
    setShowResults(false);
    // Focus the search result
    const matchingItems = dataRef.current.filter(dataItem => dataItem.id === item.id);
    setFilteredData(matchingItems);
    setSearchValue(`${item.title || ''}`);
  }, [setFilteredData]);
  
  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  // Handle clicks outside to close dropdown
  const commandRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
    <div className="w-full md:w-[200px] -mt-4" ref={commandRef}>
      <Command className="rounded-lg border overflow-visible">
        <div className="flex items-center px-2 border-b">
          <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
          <CommandInput
            placeholder="Search..."
            className="h-9 border-0 focus:ring-0 px-0"
            value={searchValue}
            onValueChange={handleSearch}
          />
        </div>
        
        {showResults && searchResults.length > 0 && (
          <CommandList className="absolute w-full bg-popover border rounded-b-lg shadow-md z-50 max-h-80">
            <CommandGroup heading="Results">
              {searchResults.map((item) => (
                <CommandItem
                  key={item.id}
                  className="cursor-pointer"
                  onSelect={() => handleSelectItem(item)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title || 'Unnamed'}</span>
                    {item.user_number && (
                      <span className="text-xs text-muted-foreground">{item.user_number}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        )}
        
        {showResults && searchResults.length === 0 && (
          <CommandList className="absolute w-full bg-popover border rounded-b-lg shadow-md z-50">
            <CommandEmpty>No results found</CommandEmpty>
          </CommandList>
        )}
      </Command>
    </div>
  );
});

SearchCommand.displayName = 'SearchCommand';
