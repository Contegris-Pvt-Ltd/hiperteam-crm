import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Notification } from '../api/notifications.api';
import { notificationsApi } from '../api/notifications.api';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UseNotificationsReturn {
  unreadCount: number;
  notifications: Notification[];
  loading: boolean;
  connected: boolean;
  // Actions
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  hasMore: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const mountedRef = useRef(true);

  // ============================================================
  // WEBSOCKET CONNECTION
  // ============================================================
  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(`${WS_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => {
      if (mountedRef.current) setConnected(true);
    });

    socket.on('disconnect', () => {
      if (mountedRef.current) setConnected(false);
    });

    // Real-time notification received
    socket.on('notification', (notification: Notification) => {
      if (!mountedRef.current) return;
      setNotifications(prev => [notification, ...prev]);
    });

    // Unread count updated
    socket.on('unread_count', (data: { count: number }) => {
      if (!mountedRef.current) return;
      setUnreadCount(data.count);
    });

    socket.on('connect_error', (err) => {
      console.warn('Notification socket connection error:', err.message);
    });

    socketRef.current = socket;

    // Fetch initial unread count via REST (fallback for when WS is slow to connect)
    notificationsApi.getUnreadCount().then(({ count }) => {
      if (mountedRef.current) setUnreadCount(count);
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ============================================================
  // LOAD NOTIFICATIONS
  // ============================================================
  const loadNotifications = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await notificationsApi.list({ page: pageNum, limit: 20 });
      if (!mountedRef.current) return;

      if (append) {
        setNotifications(prev => [...prev, ...result.data]);
      } else {
        setNotifications(result.data);
      }
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [loading]);

  // ============================================================
  // ACTIONS
  // ============================================================
  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n),
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Also notify via socket for other tabs
      if (socketRef.current?.connected) {
        socketRef.current.emit('mark_read', { notificationId: id });
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);

      if (socketRef.current?.connected) {
        socketRef.current.emit('mark_all_read');
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      await notificationsApi.dismiss(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      // If the dismissed one was unread, decrement count
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  }, [notifications]);

  const loadMore = useCallback(async () => {
    await loadNotifications(page + 1, true);
  }, [loadNotifications, page]);

  const refresh = useCallback(async () => {
    await loadNotifications(1, false);
  }, [loadNotifications]);

  const hasMore = notifications.length < total;

  return {
    unreadCount,
    notifications,
    loading,
    connected,
    markRead,
    markAllRead,
    dismiss,
    loadMore,
    refresh,
    hasMore,
  };
}

// ============================================================
// PUSH SUBSCRIPTION HELPER
// ============================================================
export async function subscribeToBrowserPush(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Get VAPID public key from server
    const { publicKey } = await notificationsApi.getVapidPublicKey();
    if (!publicKey) {
      console.warn('VAPID public key not configured');
      return false;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw-notifications.js');
    await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });

    const json = subscription.toJSON();

    // Send subscription to server
    await notificationsApi.subscribePush({
      endpoint: json.endpoint!,
      keys: {
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      },
      userAgent: navigator.userAgent,
    });

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromBrowserPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return false;

    await notificationsApi.unsubscribePush(subscription.endpoint);
    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
    return false;
  }
}

// ============================================================
// HELPER: Convert VAPID key
// ============================================================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}