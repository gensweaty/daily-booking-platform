import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type SortOrder = 'newest' | 'oldest';
export type FilterType = 'all' | 'created';

export interface CRMFilters {
  sortOrder: SortOrder;
  filterType: FilterType;
  selectedUserId?: string;
  selectedUserType?: 'admin' | 'sub_user';
  selectedUserName?: string;
}

type Ctx = {
  filters: CRMFilters;
  setSortOrder: (o: SortOrder) => void;
  setFilterType: (
    t: FilterType,
    userId?: string,
    userType?: 'admin' | 'sub_user',
    userName?: string
  ) => void;
  resetFilters: () => void;
  applyFilters: (data: any[]) => any[];
};

const STORAGE_KEY = 'crmFilters';
const CRMFiltersContext = createContext<Ctx | null>(null);

export const CRMFiltersProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [filters, setFilters] = useState<CRMFilters>(() => {
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
    userType?: 'admin' | 'sub_user',
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

  const applyFilters = useCallback((data: any[]) => {
    let filtered = data.slice();

    // Filter by Created By
    if (filters.filterType === 'created' && filters.selectedUserId) {
      const wantedType = filters.selectedUserType;

      filtered = filtered.filter(item => {
        const creatorType = item.created_by_type;
        const typeOk = creatorType === wantedType;

        if (!typeOk) return false;

        // Normalize names for comparison
        const norm = (s?: string) =>
          (s || '')
            .replace(/\s*\((Sub|External)\s*User\)\s*/gi, '')
            .trim()
            .toLowerCase();

        const itemName = norm(item.created_by_name);
        const filterName = norm(filters.selectedUserName);
        
        if (!itemName || !filterName) return false;

        return itemName === filterName || itemName.includes(filterName) || filterName.includes(itemName);
      });
    }

    // Sort by created_at
    const ts = (x: any) => new Date(x.created_at).getTime();

    filtered.sort((a, b) =>
      filters.sortOrder === 'newest' ? ts(b) - ts(a) : ts(a) - ts(b)
    );

    return filtered;
  }, [filters]);

  const value = useMemo(() => ({
    filters, setSortOrder, setFilterType, resetFilters, applyFilters
  }), [filters, setSortOrder, setFilterType, resetFilters, applyFilters]);

  return React.createElement(
    CRMFiltersContext.Provider,
    { value },
    children
  );
};

export const useCRMFilters = (): Ctx => {
  const ctx = useContext(CRMFiltersContext);
  if (!ctx) throw new Error('useCRMFilters must be used inside <CRMFiltersProvider>');
  return ctx;
};
