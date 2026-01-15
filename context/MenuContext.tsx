
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { MenuItem } from '../types';
import { getMenu } from '../services/mockApi';
import { cacheService, CACHE_KEYS } from '../services/cacheService';
import { useAuth } from './AuthContext';

interface MenuContextType {
  menuItems: MenuItem[];
  loading: boolean;
  refreshMenu: () => Promise<void>;
  updateMenuItemOptimistic: (updatedItem: MenuItem) => void;
}

const MenuContext = createContext<MenuContextType | null>(null);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Optimized: Initialize state directly from cache to avoid "loading" flash on mount.
  // This ensures the menu appears instantly (0ms) if cached data exists.
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const cached = cacheService.get<MenuItem[]>(CACHE_KEYS.MENU);
    return cached || [];
  });

  const [loading, setLoading] = useState(menuItems.length === 0);

  const fetchMenu = useCallback(async (forceRefresh = false) => {
    if (menuItems.length === 0) {
        setLoading(true);
    }

    try {
      // Fetch fresh data in background
      const data = await getMenu(user?.id);
      
      // Update state and cache
      setMenuItems(data);
      cacheService.set(CACHE_KEYS.MENU, data);
    } catch (error) {
      console.error("Failed to fetch menu", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // We always fetch on mount to check for price updates/availability, 
    // but the user sees cached data immediately.
    fetchMenu();
  }, [fetchMenu]);

  // Expose a method to update a single item locally without refetching (e.g., toggling favorite)
  const updateMenuItemOptimistic = useCallback((updatedItem: MenuItem) => {
      setMenuItems(prev => {
          const newMenu = prev.map(item => item.id === updatedItem.id ? updatedItem : item);
          cacheService.set(CACHE_KEYS.MENU, newMenu); // Update cache too
          return newMenu;
      });
  }, []);

  return (
    <MenuContext.Provider value={{ menuItems, loading, refreshMenu: () => fetchMenu(true), updateMenuItemOptimistic }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = (): MenuContextType => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
};
