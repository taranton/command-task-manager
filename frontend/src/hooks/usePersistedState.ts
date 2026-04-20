import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// Drop-in replacement for useState that writes through to localStorage.
// State is JSON-serialised under `key`. Failure is silent (private-mode,
// quota, SSR) — we never block the UI on persistence.
export function usePersistedState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota / private mode errors
    }
  }, [key, state]);

  return [state, setState];
}
