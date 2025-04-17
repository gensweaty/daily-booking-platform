
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
  // Debounce search to improve performance
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [searchValue, setSearchValue] = React.useState<string>("");
  
  // Handle search with local state to prevent re-renders
  const handleSearch = React.useCallback((search: string) => {
    setSearchValue(search);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      if (!search) {
        setFilteredData(data);
        return;
      }

      const searchLower = search.toLowerCase();
      const filtered = data.filter((item) => {
        return (
          (item.title?.toLowerCase().includes(searchLower)) ||
          (item.user_number?.toLowerCase().includes(searchLower)) ||
          (item.social_network_link?.toLowerCase().includes(searchLower)) ||
          (item.event_notes?.toLowerCase().includes(searchLower)) ||
          (item.payment_status?.toLowerCase().includes(searchLower))
        );
      });
      
      setFilteredData(filtered);
    }, 150); // 150ms debounce delay
  }, [data, setFilteredData]);
  
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
