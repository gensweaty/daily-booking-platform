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

  const applyFilters = (tasks: Task[]): Task[] => {
    let filtered = [...tasks];

    // Apply user filter (assigned or created by)
    if (filters.filterType === 'assigned' && filters.selectedUserId) {
      filtered = filtered.filter(task => {
        if (filters.selectedUserType === 'admin') {
          return task.assigned_to_type === 'admin' && task.assigned_to_id === filters.selectedUserId;
        } else {
          return task.assigned_to_type === 'sub_user' && task.assigned_to_id === filters.selectedUserId;
        }
      });
    } else if (filters.filterType === 'created' && filters.selectedUserId) {
      filtered = filtered.filter(task => {
        // Check if task was created by the selected user
        const createdByType = task.created_by_type;
        const createdByName = task.created_by_name;
        
        if (filters.selectedUserType === 'admin') {
          return createdByType === 'admin';
        } else {
          return createdByType === 'sub_user' && createdByName === filters.selectedUserId;
        }
      });
    }

    // Apply sort order
    const getSortTime = (t: Task) => new Date(t.last_edited_at || t.updated_at || t.created_at).getTime();
    
    if (filters.sortOrder === 'newest') {
      filtered.sort((a, b) => getSortTime(b) - getSortTime(a));
    } else {
      filtered.sort((a, b) => getSortTime(a) - getSortTime(b));
    }

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
