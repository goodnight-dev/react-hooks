import { useCallback, useRef, useSyncExternalStore } from 'react';

type SetValue<T> = T | ((previous: T) => T);

// Native `storage` events only fire in *other* tabs/windows, never the one
// that made the write — this is how `setValue` notifies subscribers in its
// own tab, reusing the same `subscribe` listener as the cross-tab case.
const SAME_TAB_EVENT = 'goodnight-dev:use-local-storage';

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be unavailable entirely (e.g. some private-browsing modes)
    // — treat that the same as "nothing stored yet" rather than crashing.
    return null;
  }
}

/**
 * Read and write a JSON-serializable value in `localStorage`, keyed by
 * `key`, re-rendering on change — including changes made from another tab.
 *
 * Mirrors `useState`'s own `[value, setValue]` shape rather than a
 * mutate-in-place object, so there is exactly one write path to reason
 * about. Backed by `useSyncExternalStore`: `localStorage` is the single
 * source of truth (nothing is cached in React state), so `getSnapshot`
 * re-reads it on every call, and `setValue`'s functional-update form always
 * sees the current stored value, not a stale render's closure.
 *
 * `initialValue` is only ever used the first time a key has nothing stored
 * for it, and — same as `useState` — only its *first* value is honored;
 * passing a new literal on a later render does not overwrite what is
 * already stored, so memoize non-primitive defaults yourself if you want to
 * avoid recreating them every render.
 *
 * @param key - The `localStorage` key. Changing it switches to that key's
 * own value, subscribing and reading independently.
 * @param initialValue - Returned when `key` has nothing stored yet, and
 * used as-is during SSR (there is no `localStorage` on the server).
 *
 * @example
 * ```tsx
 * const [settings, setSettings] = useLocalStorage(`users-${userId}`, defaultSettings);
 * setSettings((previous) => ({ ...previous, theme: 'dark' }));
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: SetValue<T>) => void] {
  // getSnapshot must return a reference-stable value across calls when
  // nothing changed (see ADR 0003) — JSON.parse would otherwise hand back a
  // new object every call. This caches the last parsed value against the
  // raw string it came from, so a snapshot is only rebuilt when the stored
  // string actually changes. The cache is not reset when `key` changes; the
  // raw-string comparison against the *new* key's content already fails to
  // match on its own, so it naturally reparses instead of returning a stale
  // value from the previous key.
  const cacheRef = useRef<{ raw: string | null; value: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    const cache = cacheRef.current;
    if (cache !== null && cache.raw === raw) {
      return cache.value;
    }

    let value: T;
    if (raw === null) {
      value = initialValue;
    } else {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        // Foreign or corrupted content at this key — localStorage is an
        // untrusted boundary, so fall back rather than throw.
        value = initialValue;
      }
    }
    cacheRef.current = { raw, value };
    return value;
  }, [key, initialValue]);

  const getServerSnapshot = useCallback((): T => initialValue, [initialValue]);

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const handleStorage = (event: StorageEvent): void => {
        // `event.key` is `null` when the change was `localStorage.clear()`,
        // which affects every key, this one included.
        if (event.key === null || event.key === key) onStoreChange();
      };
      const handleSameTab = (event: Event): void => {
        if ((event as CustomEvent<string>).detail === key) onStoreChange();
      };
      window.addEventListener('storage', handleStorage);
      window.addEventListener(SAME_TAB_EVENT, handleSameTab);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(SAME_TAB_EVENT, handleSameTab);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: SetValue<T>): void => {
      const resolved =
        typeof next === 'function'
          ? (next as (previous: T) => T)(getSnapshot())
          : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch (error) {
        // A failed write must not look like a successful one — report it
        // rather than silently continuing as if the value persisted.
        console.warn(
          `useLocalStorage: failed to persist "${key}" to localStorage`,
          error,
        );
        return;
      }
      window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: key }));
    },
    [key, getSnapshot],
  );

  return [value, setValue];
}
