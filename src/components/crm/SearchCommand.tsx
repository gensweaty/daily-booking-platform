import * as React from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Search } from "lucide-react"

interface SearchCommandProps {
  data: any[]
  onSelect: (item: any) => void
  setFilteredData: (data: any[]) => void
}

export function SearchCommand({ data, onSelect, setFilteredData }: SearchCommandProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSearch = React.useCallback((search: string) => {
    setSearchQuery(search);
    if (!search) {
      setFilteredData(data);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    const searchLower = search.toLowerCase();
    const filtered = data.filter((item) => {
      return (
        item.title?.toLowerCase().includes(searchLower) ||
        item.user_number?.toLowerCase().includes(searchLower) ||
        item.social_network_link?.toLowerCase().includes(searchLower) ||
        item.event_notes?.toLowerCase().includes(searchLower)
      )
    })
    setFilteredData(filtered)
  }, [data, setFilteredData])

  return (
    <Command className="w-[200px] rounded-lg border">
      <div className="flex items-center px-2">
        <Search className="mr-1 h-4 w-4 shrink-0 opacity-50" />
        <CommandInput
          placeholder="Search..."
          className="h-9 border-0 focus:ring-0 px-0"
          onValueChange={handleSearch}
        />
      </div>
      {isOpen && searchQuery && (
        <CommandList className="absolute w-[200px] mt-1 bg-white rounded-lg border shadow-md max-h-[300px] z-50">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup>
            {data.map((item) => (
              <CommandItem
                key={item.id}
                value={item.title}
                onSelect={() => {
                  onSelect(item);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="cursor-pointer"
              >
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  {item.user_number && (
                    <span className="text-sm text-muted-foreground">
                      {item.user_number}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      )}
    </Command>
  )
}