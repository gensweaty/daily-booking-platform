// Chat-specific performance optimization manager
import { performanceOptimizer } from './performanceOptimizer';

export interface NetworkQuality {
  type: 'fast' | 'slow' | 'offline';
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ChatPerformanceManager {
  private static instance: ChatPerformanceManager;
  private db: IDBDatabase | null = null;
  private dbReady: boolean = false;
  private networkQuality: NetworkQuality | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private lastNetworkCheck: number = 0;

  private constructor() {
    this.initializeDB();
    this.setupNetworkMonitoring();
  }

  static getInstance(): ChatPerformanceManager {
    if (!ChatPerformanceManager.instance) {
      ChatPerformanceManager.instance = new ChatPerformanceManager();
    }
    return ChatPerformanceManager.instance;
  }

  private async initializeDB(): Promise<void> {
    try {
      const request = indexedDB.open('ChatCache', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'channelId' });
        }
        if (!db.objectStoreNames.contains('attachments')) {
          db.createObjectStore('attachments', { keyPath: 'messageId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.dbReady = true;
      };

      request.onerror = () => {
        this.dbReady = false;
      };
    } catch (error) {
      this.dbReady = false;
    }
  }

  private setupNetworkMonitoring(): void {
    this.updateNetworkQuality();
    setInterval(() => this.updateNetworkQuality(), 30000);
  }

  private updateNetworkQuality(): void {
    const connection = (navigator as any).connection;
    if (!connection) {
      this.networkQuality = { type: 'fast', effectiveType: '4g', downlink: 5, rtt: 100 };
      return;
    }

    const effectiveType = connection.effectiveType || '4g';
    const downlink = connection.downlink || 5;
    const rtt = connection.rtt || 100;

    let type: 'fast' | 'slow' | 'offline' = 'fast';
    if (!navigator.onLine) {
      type = 'offline';
    } else if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 2) {
      type = 'slow';
    }

    this.networkQuality = { type, effectiveType, downlink, rtt };
  }

  async getCachedMessages(channelId: string): Promise<any[] | null> {
    if (!this.dbReady || !this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const request = store.get(channelId);

        request.onsuccess = () => {
          const entry = request.result;
          if (!entry || Date.now() - entry.timestamp > 300000) { // 5 min TTL
            resolve(null);
          } else {
            resolve(entry.data);
          }
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setCachedMessages(channelId: string, messages: any[]): Promise<void> {
    if (!this.dbReady || !this.db) return;

    try {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      store.put({
        channelId,
        data: messages.slice(-200), // Keep last 200 messages
        timestamp: Date.now()
      });
    } catch (error) {
      // Silently fail
    }
  }

  async removeCachedMessages(channelId: string): Promise<void> {
    if (!this.dbReady || !this.db) return;

    try {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');
      store.delete(channelId);
    } catch (error) {
      // Silently fail
    }
  }

  async getCachedAttachments(messageId: string): Promise<any[] | null> {
    if (!this.dbReady || !this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['attachments'], 'readonly');
        const store = transaction.objectStore('attachments');
        const request = store.get(messageId);

        request.onsuccess = () => {
          const entry = request.result;
          if (!entry || Date.now() - entry.timestamp > 1800000) { // 30 min TTL
            resolve(null);
          } else {
            resolve(entry.data);
          }
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setCachedAttachments(messageId: string, attachments: any[]): Promise<void> {
    if (!this.dbReady || !this.db) return;

    try {
      const transaction = this.db.transaction(['attachments'], 'readwrite');
      const store = transaction.objectStore('attachments');
      store.put({
        messageId,
        data: attachments,
        timestamp: Date.now()
      });
    } catch (error) {
      // Silently fail
    }
  }

  debounceRequest<T>(key: string, requestFn: () => Promise<T>, delay: number = 300): Promise<T> {
    if (this.requestQueue.has(key)) {
      this.requestQueue.delete(key);
    }

    const debouncedFn = performanceOptimizer.debounce(requestFn, delay);
    const promise = Promise.resolve(debouncedFn()) as Promise<T>;
    
    this.requestQueue.set(key, promise);
    promise.finally(() => this.requestQueue.delete(key));

    return promise;
  }

  getOptimalPollingInterval(): number {
    if (!this.networkQuality) return 2500;
    return this.networkQuality.type === 'slow' ? 10000 : 2500;
  }

  getOptimalBatchSize(): number {
    if (!this.networkQuality) return 50;
    return this.networkQuality.type === 'slow' ? 25 : 50;
  }

  shouldUseRealtime(): boolean {
    return this.networkQuality?.type !== 'offline';
  }

  getPerformanceStats() {
    return {
      networkQuality: this.networkQuality,
      dbReady: this.dbReady,
      activeRequests: this.requestQueue.size,
      pollingInterval: this.getOptimalPollingInterval(),
      batchSize: this.getOptimalBatchSize(),
      realtimeEnabled: this.shouldUseRealtime()
    };
  }

  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.requestQueue.clear();
    this.dbReady = false;
  }
}

export const chatPerformanceManager = ChatPerformanceManager.getInstance();