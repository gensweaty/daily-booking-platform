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

      filtered = filtered.filter(task => {
        console.log(`🔍 Checking task "${task.title}":`, {
          taskCreatedByType: task.created_by_type,
          taskCreatedByName: task.created_by_name,
          filterType: filters.selectedUserType,
          filterName: filters.selectedUserName
        });

        // First check if types match
        if (task.created_by_type !== filters.selectedUserType) {
          console.log(`❌ Type mismatch: ${task.created_by_type} !== ${filters.selectedUserType}`);
          return false;
        }
        
        // For admin, match ANY task created by admin since there's only one admin per board
        if (filters.selectedUserType === 'admin') {
          console.log('✅ Admin creator match:', task.title);
          return true;
        }
        
        // For sub-users, we need more flexible matching
        const taskCreatorName = (task.created_by_name || '').trim();
        const selectedUserName = (filters.selectedUserName || '').trim();
        
        // If task has no creator name but type matches, it's a potential match
        if (!taskCreatorName) {
          console.log('⚠️ Task has no creator name, but type matches');
          return true; // Include tasks where type matches but name is missing
        }

        if (!selectedUserName) {
          console.log('❌ Missing filter name');
          return false;
        }

        // Normalize function: remove all known suffixes and special characters
        const normalizeCreatorName = (name: string) => {
          return name
            .replace(/\s*\(Sub User\)\s*/gi, '')
            .replace(/\s*\(external_user\)\s*/gi, '')
            .replace(/\s*\(External User\)\s*/gi, '')
            .trim()
            .toLowerCase();
        };

        const normalizedTaskName = normalizeCreatorName(taskCreatorName);
        const normalizedFilterName = normalizeCreatorName(selectedUserName);

        // Try exact match first
        if (normalizedTaskName === normalizedFilterName) {
          console.log('✅ Exact match:', task.title);
          return true;
        }

        // Try partial match (in case one contains the other)
        if (normalizedTaskName.includes(normalizedFilterName) || 
            normalizedFilterName.includes(normalizedTaskName)) {
          console.log('✅ Partial match:', task.title);
          return true;
        }

        console.log('❌ No match:', {
          taskName: normalizedTaskName,
          filterName: normalizedFilterName
        });
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
  };
};
