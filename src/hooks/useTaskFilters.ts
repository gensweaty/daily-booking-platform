import { useState, useEffect, useCallback } from 'react';
import { Task } from '@/lib/types';
import { AssigneeOption } from './useTaskAssignment';

export type SortOrder = 'newest' | 'oldest';
export type FilterType = 'all' | 'assigned' | 'created';

export interface TaskFilters {
  sortOrder: SortOrder;
  filterType: FilterType;
  selectedUserId?: string;
  selectedUserType?: 'admin' | 'sub_user';
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

  const setFilterType = (filterType: FilterType, userId?: string, userType?: 'admin' | 'sub_user') => {
    setFilters(prev => ({
      ...prev,
      filterType,
      selectedUserId: userId,
      selectedUserType: userType,
    }));
  };

  const resetFilters = () => {
    setFilters({
      sortOrder: 'newest',
      filterType: 'all',
    });
  };

  // Wrap applyFilters in useCallback to make it stable across renders
  const applyFilters = useCallback((tasks: Task[]): Task[] => {
    let filtered = [...tasks];

    // Apply user filter (assigned or created by)
    if (filters.filterType === 'assigned' && filters.selectedUserId) {
      // Filter by who the task is assigned to
      filtered = filtered.filter(task => {
        return task.assigned_to_type === filters.selectedUserType && 
               task.assigned_to_id === filters.selectedUserId;
      });
    } else if (filters.filterType === 'created' && filters.selectedUserId) {
      // Filter by who created the task
      filtered = filtered.filter(task => {
        return task.created_by_type === filters.selectedUserType && 
               task.created_by_name === filters.selectedUserId;
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
  }, [filters.filterType, filters.selectedUserId, filters.selectedUserType, filters.sortOrder]);

  return {
    filters,
    setSortOrder,
    setFilterType,
    resetFilters,
    applyFilters,
  };
};
