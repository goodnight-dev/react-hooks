import { useMemo, useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

export type Theme = 'dark' | 'light';

export interface ThemePreference {
  readonly isDarkMode: boolean;
  readonly isLightMode: boolean;
  /**
   * `'dark'` or `'light'`, or `undefined` before the client has reported its
   * actual preference (always the case during SSR).
   */
  readonly theme: Theme | undefined;
}

const getSnapshot = (): Theme =>
  window.matchMedia(QUERY).matches ? 'dark' : 'light';

// There is no correct guess on the server — returning a default risks a
// hydration mismatch the moment the client's real preference differs.
// `undefined` lets a consumer render a neutral first paint and commit to a
// theme only once the client has mounted and reported the real value.
const getServerSnapshot = (): undefined => undefined;

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQueryList = window.matchMedia(QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => {
    mediaQueryList.removeEventListener('change', onStoreChange);
  };
};

/**
 * Read the user's OS-level color scheme preference
 * (`prefers-color-scheme`), and stay in sync as they change it.
 *
 * Backed by `useSyncExternalStore`, so it is safe under concurrent rendering
 * and does not tear. `theme` is `undefined` on the server — and on the client
 * until the first `matchMedia` read commits — render a neutral state for that
 * case rather than branching on `isDarkMode` / `isLightMode`, which are both
 * `false` until `theme` resolves (there are only two real themes, so "both
 * false" is unambiguous evidence that the preference isn't known yet).
 *
 * @returns `theme` plus `isDarkMode` / `isLightMode` convenience booleans.
 * The returned object is memoized, so its identity only changes when `theme`
 * does.
 *
 * @example
 * ```tsx
 * const { theme, isDarkMode } = useTheme();
 * if (theme === undefined) return null; // avoid a flash of the wrong theme
 * return <div data-theme={theme}>{isDarkMode ? '🌙' : '☀️'}</div>;
 * ```
 */
export function useTheme(): Readonly<ThemePreference> {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // useSyncExternalStore's own snapshot (the primitive `theme` above) must be
  // reference-stable across calls when nothing changed, which a plain string
  // already is. This object is *derived* from that snapshot, not the
  // snapshot itself, so it needs its own memoization — building it inline
  // here would hand back a new object identity on every render regardless of
  // whether `theme` changed, defeating consumers that depend on referential
  // equality (e.g. a `useEffect` dependency, or `React.memo`).
  return useMemo(
    () => ({
      theme,
      isDarkMode: theme === 'dark',
      isLightMode: theme === 'light',
    }),
    [theme],
  );
}
