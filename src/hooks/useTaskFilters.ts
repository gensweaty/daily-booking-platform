import { useState, useEffect } from 'react';
import { Task } from '@/lib/types';
import { AssigneeOption } from './useTaskAssignment';

export type SortOrder = 'newest' | 'oldest';
export type FilterType = 'all' | 'assigned' | 'created';

export interface TaskFilters {
  sortOrder: SortOrder;
  filterType: FilterType;
  selectedUserId?: string;
  selectedUserType?: 'admin' | 'sub_user';
  selectedUserName?: string; // Add name for display/matching
}

const STORAGE_KEY = 'taskFilters';

export const useTaskFilters = () => {
  const [filters, setFilters] = useState<TaskFilters>(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          sortOrder: 'newest' as SortOrder,
          filterType: 'all' as FilterType,
        };
      }
    }
    return {
      sortOrder: 'newest' as SortOrder,
      filterType: 'all' as FilterType,
    };
  });

  // Save to localStorage whenever filters change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const setSortOrder = (sortOrder: SortOrder) => {
    setFilters(prev => ({ ...prev, sortOrder }));
  };

  const setFilterType = (
    filterType: FilterType, 
    userId?: string, 
    userType?: 'admin' | 'sub_user',
    userName?: string
  ) => {
    setFilters(prev => ({
      ...prev,
      filterType,
      selectedUserId: userId,
      selectedUserType: userType,
      selectedUserName: userName,
    }));
  };

  const resetFilters = () => {
    setFilters({
      sortOrder: 'newest',
      filterType: 'all',
    });
  };

  // Apply filters - NOT wrapped in useCallback to ensure it always uses latest filters
  const applyFilters = (tasks: Task[]): Task[] => {
    let filtered = [...tasks];

    // Apply user filter (assigned or created by)
    if (filters.filterType === 'assigned' && filters.selectedUserId) {
      // Filter by who the task is assigned to (use ID for exact matching)
      filtered = filtered.filter(task => {
        return task.assigned_to_type === filters.selectedUserType && 
               task.assigned_to_id === filters.selectedUserId;
      });
    } else if (filters.filterType === 'created' && filters.selectedUserId) {
      // Filter by who created the task
      // Handle multiple formats: exact ID match, name match, or partial name match
      filtered = filtered.filter(task => {
        // First check if types match
        if (task.created_by_type !== filters.selectedUserType) {
          return false;
        }
        
        // For matching, try multiple strategies:
        // 1. Exact ID match (most reliable)
        if (task.created_by_name === filters.selectedUserId) {
          return true;
        }
        
        // 2. If we have a name, try matching against it
        if (filters.selectedUserName) {
          const taskCreatorName = task.created_by_name || '';
          const filterName = filters.selectedUserName;
          
          // Handle "(Sub User)" suffix - remove it for comparison
          const normalizedTaskName = taskCreatorName.replace(/\s*\(Sub User\)\s*/gi, '').trim();
          const normalizedFilterName = filterName.replace(/\s*\(Sub User\)\s*/gi, '').trim();
          
          // Try exact match on normalized names
          if (normalizedTaskName === normalizedFilterName) {
            return true;
          }
          
          // Try case-insensitive match
          if (normalizedTaskName.toLowerCase() === normalizedFilterName.toLowerCase()) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Apply sort order based on last edited time
    const getSortTime = (t: Task) => new Date(t.last_edited_at || t.updated_at || t.created_at).getTime();
    
    filtered.sort((a, b) => {
      return filters.sortOrder === 'newest' 
        ? getSortTime(b) - getSortTime(a)
        : getSortTime(a) - getSortTime(b);
    });

    return filtered;
  };

  return {
    filters,
    setSortOrder,
    setFilterType,
    resetFilters,
    applyFilters,
  };
};
