import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Task } from '@/lib/types';

export type SortOrder = 'newest' | 'oldest';
export type FilterType = 'all' | 'assigned' | 'created';

export interface TaskFilters {
  sortOrder: SortOrder;
  filterType: FilterType;
  selectedUserId?: string;
  selectedUserType?: 'admin' | 'sub_user' | 'external_user';
  selectedUserName?: string;
}

type Ctx = {
  filters: TaskFilters;
  setSortOrder: (o: SortOrder) => void;
  setFilterType: (
    t: FilterType,
    userId?: string,
    userType?: 'admin' | 'sub_user' | 'external_user',
    userName?: string
  ) => void;
  resetFilters: () => void;
  applyFilters: (tasks: Task[]) => Task[];
};

const STORAGE_KEY = 'taskFilters';
const TaskFiltersContext = createContext<Ctx | null>(null);

export const TaskFiltersProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [filters, setFilters] = useState<TaskFilters>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored
        ? JSON.parse(stored)
        : { sortOrder: 'newest', filterType: 'all' };
    } catch {
      return { sortOrder: 'newest', filterType: 'all' };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const setSortOrder = useCallback((sortOrder: SortOrder) => {
    setFilters(prev => ({ ...prev, sortOrder }));
  }, []);

  const setFilterType = useCallback((
    filterType: FilterType,
    userId?: string,
    userType?: 'admin' | 'sub_user' | 'external_user',
    userName?: string
  ) => {
    setFilters(prev => ({
      ...prev,
      filterType,
      selectedUserId: userId,
      selectedUserType: userType,
      selectedUserName: userName
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ sortOrder: 'newest', filterType: 'all' });
  }, []);

  const applyFilters = useCallback((tasks: Task[]) => {
    let filtered = tasks.slice();

    // Assigned To (exact by id + type)
    if (filters.filterType === 'assigned' && filters.selectedUserId) {
      filtered = filtered.filter(t =>
        t.assigned_to_id === filters.selectedUserId &&
        t.assigned_to_type === filters.selectedUserType
      );
    }

    // Created By — prefer id match; fall back to normalized name; accept external_user as sub_user
    if (filters.filterType === 'created' && filters.selectedUserId) {
      const wantedType = filters.selectedUserType === 'external_user' ? 'external_user' : filters.selectedUserType;

      filtered = filtered.filter(t => {
        // type match (tolerate external_user vs sub_user when only name exists)
        const typeOk =
          t.created_by_type === wantedType ||
          (t.created_by_type === 'external_user' && wantedType === 'sub_user');

        if (!typeOk) return false;

        // if task has creator id, use that (most reliable)
        if ((t as any).created_by_id && filters.selectedUserId) {
          return (t as any).created_by_id === filters.selectedUserId;
        }

        // fallback: compare normalized names
        const norm = (s?: string) =>
          (s || '')
            .replace(/\s*\((Sub|External)\s*User\)\s*/gi, '')
            .trim()
            .toLowerCase();

        const taskName = norm(t.created_by_name);
        const filterName = norm(filters.selectedUserName);
        if (!taskName || !filterName) return false;

        return taskName === filterName || taskName.includes(filterName) || filterName.includes(taskName);
      });
    }

    // Sort by last_edited_at || updated_at || created_at
    const ts = (x: Task) =>
      new Date(x.last_edited_at || x.updated_at || x.created_at).getTime();

    filtered.sort((a, b) =>
      filters.sortOrder === 'newest' ? ts(b) - ts(a) : ts(a) - ts(b)
    );

    return filtered;
  }, [filters]);

  const value = useMemo(() => ({
    filters, setSortOrder, setFilterType, resetFilters, applyFilters
  }), [filters, setSortOrder, setFilterType, resetFilters, applyFilters]);

  return React.createElement(
    TaskFiltersContext.Provider,
    { value },
    children
  );
};

export const useTaskFilters = (): Ctx => {
  const ctx = useContext(TaskFiltersContext);
  if (!ctx) throw new Error('useTaskFilters must be used inside <TaskFiltersProvider>');
  return ctx;
};
