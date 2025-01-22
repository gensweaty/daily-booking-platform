import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"

interface SearchCommandProps {
  data: any[]
  setFilteredData: (data: any[]) => void
  onSelect?: (customerId: string) => Promise<void>
}

export function SearchCommand({ data, setFilteredData, onSelect }: SearchCommandProps) {
  const handleSearch = React.useCallback((search: string) => {
    if (!search) {
      setFilteredData(data);
      return;
    }

    const searchLower = search.toLowerCase();
    const filtered = data.filter((item) => {
      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.user_surname?.toLowerCase().includes(searchLower) ||
        item.social_network_link?.toLowerCase().includes(searchLower) ||
        item.event_notes?.toLowerCase().includes(searchLower) ||
        item.payment_status?.toLowerCase().includes(searchLower)
      );
    });
    
    setFilteredData(filtered);
  }, [data, setFilteredData]);

  return (
    <Command className="w-full md:w-[200px] rounded-lg border -mt-4">
      <div className="flex items-center px-2">
        <CommandInput
          placeholder="Search..."
          className="h-9 border-0 focus:ring-0 px-0"
          onValueChange={handleSearch}
        />
      </div>
    </Command>
  );
}