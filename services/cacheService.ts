
export const CACHE_KEYS = {
  MENU: 'app_cache_menu',
  USER_FAVORITES: 'app_cache_favorites',
};

const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour

interface CacheItem<T> {
  data: T;
  expiry: number;
}

export const cacheService = {
  set: <T>(key: string, data: T, ttl: number = DEFAULT_TTL): void => {
    try {
      const item: CacheItem<T> = {
        data,
        expiry: Date.now() + ttl,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Failed to save to cache', e);
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      const item: CacheItem<T> = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.data;
    } catch (e) {
      return null;
    }
  },

  remove: (key: string): void => {
    localStorage.removeItem(key);
  },
  
  clearAll: (): void => {
      // Clear only app keys to be safe
      Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};
