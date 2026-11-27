import { useSyncExternalStore } from 'react';

// `navigator.onLine` is a flag the browser maintains; it changes in response
// to these two `window` events, not any polling or promise, so subscribing is
// just attaching both listeners. (`online` and `offline` fire on `window` per
// the HTML spec.) No per-call arguments means these closures never need
// rebuilding, so — like `useTheme` — they live at module scope and are shared
// across every hook instance rather than recreated per render.
const subscribe = (onStoreChange: () => void): (() => void) => {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
};

// A primitive `boolean` is already reference-stable across calls, so unlike
// `useWindowSize` / `useLocalStorage` (whose object/parsed snapshots need a
// cache) there is nothing to memoize here — same as `useTheme`'s `Theme`.
const getSnapshot = (): boolean => navigator.onLine;

// There is no `navigator` on the server, and the client's real connectivity
// is unknowable at server-render time — the server having served the request
// says nothing about the browser that will hydrate the HTML. Returning
// `undefined` rather than React's own docs' `true` keeps this package's
// "never guess a client-only value on the server" contract, the same one
// `useTheme` and `useWindowSize` follow; see use-online-status.md for why that
// `true` default is a guess worth refusing.
const getServerSnapshot = (): undefined => undefined;

/**
 * Read whether the browser currently has a network connection
 * (`navigator.onLine`), staying in sync as it connects and disconnects.
 *
 * Backed by `useSyncExternalStore`, so it is safe under concurrent rendering
 * and does not tear. The value is `undefined` on the server — and on the
 * client until the first `navigator.onLine` read commits — the same "unknown
 * until proven otherwise" contract `useTheme` uses for `theme`: there is no
 * honest value to render for a client whose connectivity the server cannot
 * know, so render a neutral state for `undefined` rather than assuming online.
 *
 * `navigator.onLine` is necessary but not sufficient: `false` means the
 * browser knows it is offline, but `true` only means it has *a* network
 * interface, not that the internet is actually reachable — a captive portal
 * or a dead upstream link still reads `true`. Treat it as "definitely
 * offline" vs. "probably online," not a reachability check; confirm with a
 * real request if you need certainty.
 *
 * @returns `true` when the browser reports a connection, `false` when it
 * reports none, and `undefined` until the client has read the real value
 * (always the case during SSR).
 *
 * @example
 * ```tsx
 * const isOnline = useOnlineStatus();
 * if (isOnline === undefined) return null; // don't assume online before we know
 * return isOnline ? <App /> : <OfflineBanner />;
 * ```
 */
export function useOnlineStatus(): boolean | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
