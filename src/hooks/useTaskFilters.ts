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
    console.log('🔍 [FILTER DEBUG] Applying filters:', {
      filterType: filters.filterType,
      selectedUserId: filters.selectedUserId,
      selectedUserType: filters.selectedUserType,
      selectedUserName: filters.selectedUserName,
      totalTasks: tasks.length
    });

    let filtered = [...tasks];

    // Apply user filter (assigned or created by)
    if (filters.filterType === 'assigned' && filters.selectedUserId) {
      // Filter by who the task is assigned to (use ID for exact matching)
      filtered = filtered.filter(task => {
        const matches = task.assigned_to_type === filters.selectedUserType && 
               task.assigned_to_id === filters.selectedUserId;
        if (matches) {
          console.log('✅ Task assigned to match:', task.title);
        }
        return matches;
      });
      console.log(`📊 After assigned filter: ${filtered.length} tasks`);
    } else if (filters.filterType === 'created' && filters.selectedUserId) {
      // Filter by who created the task
      console.log('🔍 Filtering by creator:', {
        selectedUserId: filters.selectedUserId,
        selectedUserType: filters.selectedUserType,
        selectedUserName: filters.selectedUserName
      });

      // Log all tasks to see their creator info
      tasks.forEach(task => {
        console.log('📝 Task creator info:', {
          title: task.title,
          created_by_name: task.created_by_name,
          created_by_type: task.created_by_type
        });
      });

      filtered = filtered.filter(task => {
        // First check if types match
        if (task.created_by_type !== filters.selectedUserType) {
          return false;
        }
        
        const taskCreatorName = task.created_by_name || '';
        const selectedUserId = filters.selectedUserId;
        const selectedUserName = filters.selectedUserName || '';

        // Strategy 1: Exact match with selected ID
        if (taskCreatorName === selectedUserId) {
          console.log('✅ Exact ID match:', task.title);
          return true;
        }

        // Strategy 2: Match against selected name (handle various formats)
        // Remove "(Sub User)" and "external_user" suffixes for comparison
        const normalizedTaskName = taskCreatorName
          .replace(/\s*\(Sub User\)\s*/gi, '')
          .replace(/\s*\(external_user\)\s*/gi, '')
          .trim();
        const normalizedFilterName = selectedUserName
          .replace(/\s*\(Sub User\)\s*/gi, '')
          .replace(/\s*\(external_user\)\s*/gi, '')
          .trim();

        // Try exact match
        if (normalizedTaskName === normalizedFilterName) {
          console.log('✅ Name exact match:', task.title);
          return true;
        }

        // Try case-insensitive match
        if (normalizedTaskName.toLowerCase() === normalizedFilterName.toLowerCase()) {
          console.log('✅ Name case-insensitive match:', task.title);
          return true;
        }

        // Strategy 3: Try matching with the ID directly against name field
        // (in case name was stored in the ID field)
        if (normalizedTaskName === selectedUserId || normalizedTaskName.toLowerCase() === selectedUserId.toLowerCase()) {
          console.log('✅ Task name matches selected ID:', task.title);
          return true;
        }

        return false;
      });
      console.log(`📊 After created filter: ${filtered.length} tasks`);
    }

    // Apply sort order based on last edited time
    const getSortTime = (t: Task) => new Date(t.last_edited_at || t.updated_at || t.created_at).getTime();
    
    filtered.sort((a, b) => {
      return filters.sortOrder === 'newest' 
        ? getSortTime(b) - getSortTime(a)
        : getSortTime(a) - getSortTime(b);
    });

    console.log(`📊 Final filtered count: ${filtered.length} tasks`);
    return filtered;
  };

  return {
    filters,
    setSortOrder,
    setFilterType,
    resetFilters,
    applyFilters,
    // Return a unique key that changes when filters change to force re-renders
    filterKey: `${filters.sortOrder}-${filters.filterType}-${filters.selectedUserId}-${filters.selectedUserType}`,
  };
};
