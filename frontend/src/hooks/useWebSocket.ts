import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export function useWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectDelay = useRef(1000);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      const type = msg.type as string;

      if (type.startsWith('task.') || type.startsWith('subtask.')) {
        qc.invalidateQueries({ queryKey: ['board'] });
        qc.invalidateQueries({ queryKey: ['stories'] });
        // Invalidate specific task if open
        if (msg.payload?.id) {
          qc.invalidateQueries({ queryKey: ['task', msg.payload.id] });
        }
      }

      if (type === 'story.updated') {
        qc.invalidateQueries({ queryKey: ['stories'] });
        qc.invalidateQueries({ queryKey: ['board'] });
        if (msg.payload?.id) {
          qc.invalidateQueries({ queryKey: ['story', msg.payload.id] });
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [qc]);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        reconnectDelay.current = 1000; // reset on successful connect
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect with exponential backoff
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = window.setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
          connect();
        }, reconnectDelay.current);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // WebSocket not available
    }
  }, [handleMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Reconnect when token changes (login/logout)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'access_token') {
        if (wsRef.current) wsRef.current.close();
        if (e.newValue) connect();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [connect]);
}
