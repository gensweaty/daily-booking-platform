import { Filter, Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCRMFilters, SortOrder, FilterType } from "@/hooks/useCRMFilters";
import { useTaskAssignment } from "@/hooks/useTaskAssignment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface CRMFilterButtonProps {
  boardOwnerId?: string;
}

export const CRMFilterButton = ({ boardOwnerId }: CRMFilterButtonProps) => {
  const { filters, setSortOrder, setFilterType, resetFilters } = useCRMFilters();
  const { assignees, isLoading } = useTaskAssignment(boardOwnerId);
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  const sortOptions: { value: SortOrder; label: string; labelKa: string }[] = [
    { value: 'newest', label: 'Newest First', labelKa: 'ახალიდან ძველისკენ' },
    { value: 'oldest', label: 'Oldest First', labelKa: 'ძველიდან ახალისკენ' },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isActiveFilter = filters.filterType !== 'all' || filters.sortOrder !== 'newest';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 h-10 text-xs sm:text-sm relative ${
            isActiveFilter ? 'border-primary bg-primary/5' : ''
          }`}
        >
          <Filter className={`w-3 h-3 sm:w-4 sm:h-4 ${isActiveFilter ? 'text-primary' : ''}`} />
          <span className="hidden sm:inline">
            {isGeorgian ? <GeorgianAuthText>ფილტრი</GeorgianAuthText> : 'Filter'}
          </span>
          {isActiveFilter && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-[11000] bg-background">
        <DropdownMenuLabel className="font-semibold">
          {isGeorgian ? <GeorgianAuthText>დალაგება</GeorgianAuthText> : 'Sort Order'}
        </DropdownMenuLabel>
        {sortOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setSortOrder(option.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{isGeorgian ? option.labelKa : option.label}</span>
            {filters.sortOrder === option.value && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="font-semibold">
          {isGeorgian ? <GeorgianAuthText>ფილტრი</GeorgianAuthText> : 'Filter By'}
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => setFilterType('all')}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>{isGeorgian ? <GeorgianAuthText>ყველა კლიენტი</GeorgianAuthText> : 'All Customers'}</span>
          {filters.filterType === 'all' && (
            <Check className="w-4 h-4 text-primary" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <UserPlus className="w-4 h-4 mr-2" />
            <span>{isGeorgian ? <GeorgianAuthText>შექმნილი</GeorgianAuthText> : 'Created By'}</span>
            {filters.filterType === 'created' && (
              <Check className="w-4 h-4 ml-auto text-primary" />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-[11001] bg-background max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <DropdownMenuItem disabled>
                {isGeorgian ? <GeorgianAuthText>იტვირთება...</GeorgianAuthText> : 'Loading...'}
              </DropdownMenuItem>
            ) : assignees.length === 0 ? (
              <DropdownMenuItem disabled>
                {isGeorgian ? <GeorgianAuthText>მომხმარებლები არ არიან</GeorgianAuthText> : 'No users available'}
              </DropdownMenuItem>
            ) : (
              assignees.map((assignee) => (
                <DropdownMenuItem
                  key={`created-${assignee.type}-${assignee.id}`}
                  onClick={() => setFilterType('created', assignee.id, assignee.type, assignee.name)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={assignee.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{assignee.name}</span>
                  {filters.filterType === 'created' && 
                   filters.selectedUserId === assignee.id && 
                   filters.selectedUserType === assignee.type && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {isActiveFilter && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={resetFilters}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              {isGeorgian ? <GeorgianAuthText>გადატვირთვა</GeorgianAuthText> : 'Reset Filters'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
