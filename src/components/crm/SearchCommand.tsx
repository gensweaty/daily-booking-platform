
import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Search } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText"

interface SearchCommandProps {
  data: any[]
  setFilteredData: (data: any[]) => void
  isLoading?: boolean
  resetPagination?: () => void
}

export const SearchCommand = React.memo(({ data, setFilteredData, isLoading, resetPagination }: SearchCommandProps) => {
  // Use ref for the current data to avoid unnecessary re-renders
  const dataRef = React.useRef(data);
  const [searchValue, setSearchValue] = React.useState<string>("");
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

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
    
    // Dispatch event to notify CustomerList about search value change
    if (typeof window !== 'undefined') {
      const evt = new CustomEvent('crm-search-updated', { detail: search });
      window.dispatchEvent(evt);
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
    
    // Reset pagination to the first page when search results change
    if (resetPagination) {
      resetPagination();
    }
  };

  // Clean up event listener on component unmount
  React.useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('crm-search-updated', () => {});
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
          placeholder={isGeorgian ? "ძიება..." : "Search..."}
          className={`h-9 ${isGeorgian ? "georgian-text-fix" : ""}`}
          value={searchValue}
          onValueChange={handleSearch}
        />
      </Command>
    </div>
  );
});

SearchCommand.displayName = 'SearchCommand';
