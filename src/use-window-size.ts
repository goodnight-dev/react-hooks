import { useCallback, useRef, useSyncExternalStore } from 'react';

export interface WindowSize {
  /**
   * The viewport width in CSS pixels, or `undefined` before the client has
   * reported its actual size (always the case during SSR).
   */
  readonly width: number | undefined;
  /**
   * The viewport height in CSS pixels, or `undefined` before the client has
   * reported its actual size (always the case during SSR).
   */
  readonly height: number | undefined;
}

// There is no correct guess on the server — returning a default risks a
// layout mismatch the moment the client's real viewport differs. A single
// constant is enough (rather than allocating `{ width: undefined, height:
// undefined }` per call): the value never changes, so there's nothing to
// cache against.
const SERVER_SNAPSHOT: WindowSize = { width: undefined, height: undefined };

const getServerSnapshot = (): WindowSize => SERVER_SNAPSHOT;

const subscribe = (onStoreChange: () => void): (() => void) => {
  window.addEventListener('resize', onStoreChange);
  return () => {
    window.removeEventListener('resize', onStoreChange);
  };
};

/**
 * Read the browser viewport's `width` and `height` (in CSS pixels), staying
 * in sync as the window is resized.
 *
 * Backed by `useSyncExternalStore`, so it is safe under concurrent rendering
 * and does not tear. `width` and `height` are `undefined` on the server —
 * and on the client until the first resize-store read commits — the same
 * "unknown until proven otherwise" contract `useTheme` uses for `theme`,
 * applied to both fields here since neither has a safe default to guess.
 *
 * @returns `width` and `height` in CSS pixels, each `undefined` until the
 * client has reported the real viewport size. The returned object is
 * memoized, so its identity only changes when a dimension does.
 *
 * @example
 * ```tsx
 * const { width, height } = useWindowSize();
 * if (width === undefined || height === undefined) return null; // avoid laying out against an unknown size
 * return <div>{width} × {height}</div>;
 * ```
 */
export function useWindowSize(): Readonly<WindowSize> {
  // getSnapshot must return a reference-stable value across calls when
  // nothing changed (see ADR 0003) — `window.innerWidth` / `innerHeight` are
  // cheap to read, but a fresh `{ width, height }` object literal would not
  // be, allocating a "new" snapshot every call. Same technique as
  // useLocalStorage's parse cache: cache the last snapshot and only replace
  // it when a dimension actually changed. Scoped to this hook instance via
  // `useRef`, not module state — see use-window-size.md for why a size this
  // small isn't worth sharing across instances.
  const cacheRef = useRef<WindowSize | null>(null);

  const getSnapshot = useCallback((): WindowSize => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cache = cacheRef.current;
    if (cache !== null && cache.width === width && cache.height === height) {
      return cache;
    }
    const next: WindowSize = { width, height };
    cacheRef.current = next;
    return next;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
