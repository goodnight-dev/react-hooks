# `useTheme`

> Read the user's OS-level `prefers-color-scheme`, and stay in sync as they
> change it in their system settings.

## Chosen implementation

```ts
export function useTheme(): ThemePreference {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      theme,
      isDarkMode: theme === 'dark',
      isLightMode: theme === 'light',
    }),
    [theme],
  );
}
```

Why this one:

- **`useSyncExternalStore`, not `useEffect` + `useState`.** This is the hook
  React ships specifically for subscribing to a store that lives outside React —
  `matchMedia` here. It's the only approach that is safe under concurrent
  rendering: with `useEffect` + `useState`, a mid-render OS preference change
  can be read inconsistently across a tree that suspends or is interrupted
  (tearing). `useSyncExternalStore` guarantees every consumer sees the same
  value in a given render.
- **`getServerSnapshot` returns `undefined`, not a guessed default.** There is
  no correct guess on the server: `matchMedia` does not exist there, and
  defaulting to `'light'` (or `'dark'`) is a coin flip that mismatches the
  client half the time, which React's hydration reports as an error. Returning
  `undefined` pushes the "what do I render before I know" decision to the
  consumer, where it belongs.
- **`window` is referenced directly in `getSnapshot` / `subscribe`, unguarded.**
  This is safe, not an oversight: React only calls `getServerSnapshot` while
  rendering on the server, and `subscribe` only after the component has mounted
  on the client — so `getSnapshot` and `subscribe` are guaranteed to run in a
  browser every time, by `useSyncExternalStore`'s own contract, not by
  assumption. That guarantee depends on both functions staying private module
  closures that are never exported or called from anywhere except the
  `useSyncExternalStore` call above; if a future change ever calls either of
  them directly (e.g. to expose a synchronous "read once" escape hatch), it
  needs its own SSR guard.
- **`isDarkMode` / `isLightMode` as convenience booleans, not a third `resolved`
  flag.** There are only two real themes, so both booleans being `false` at once
  is already unambiguous evidence that `theme` hasn't resolved yet — a consumer
  that only cares about the common case never has to touch `undefined` at all,
  while `theme` stays available for anyone who wants the tri-state value
  directly (e.g. `data-theme={theme}`).
- **The returned object is built with `useMemo`, keyed on `theme` — not returned
  directly from `getSnapshot`.** `useSyncExternalStore` requires `getSnapshot`
  to return a value that is reference-stable (`Object.is`-equal) across calls
  when nothing changed; a plain string satisfies that for free, but a freshly
  built `{ theme, isDarkMode, isLightMode }` object would not — every call would
  be a "new" snapshot, which can cause React to think the store changed on every
  render. Keeping `getSnapshot` returning the cheap primitive and deriving the
  richer, memoized object one layer up in the hook body gets the ergonomic API
  without breaking that contract. See
  [ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md).
- **One `MediaQueryList` per subscription, not a shared module-level one.**
  `subscribe` calls `window.matchMedia` itself rather than caching a shared
  list, so each subscriber's `addEventListener`/`removeEventListener` pair is
  symmetric and the hook works correctly if used from multiple components at
  once, each mounting/unmounting independently.

## Alternatives considered

### 1. `useEffect` + `useState`

```ts
const [theme, setTheme] = useState<Theme>(() => getSnapshot());
useEffect(() => {
  const mql = window.matchMedia(QUERY);
  const handler = () => setTheme(getSnapshot());
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}, []);
```

- The obvious first approach, and fine for a component that renders in
  isolation.
- Not safe under React's concurrent features: state set from an effect can
  desync from a store update that happened during a render React later discards
  and retries, which is exactly the class of bug `useSyncExternalStore` exists
  to close.
- Also has no SSR story on its own — `getSnapshot` reads `window` directly, so
  the lazy `useState` initializer throws server-side unless separately guarded.
  Rejected in favor of the hook designed for this.

### 2. Resize/media-query polling

Polling `matchMedia(...).matches` on an interval or on `window.resize` instead
of listening for the query's own `change` event.

- `prefers-color-scheme` changes when the OS theme changes (e.g. a scheduled
  dark-mode switch, or the user toggling System Settings), which fires no
  `resize` event at all. Polling would miss the transition entirely until
  something else happened to trigger a re-render. Rejected: wrong event to
  listen for.

### 3. A shared/global subscription (module-level singleton)

Creating a single `MediaQueryList` and listener at module scope, shared by every
`useTheme()` call, instead of one per subscription.

- Marginally fewer `matchMedia` calls, but couples every consumer's lifecycle to
  module state that outlives any single component, which complicates testing
  (module state has to be reset between tests) and server-side rendering (module
  scope can be shared across requests in some runtimes, leaking one request's
  subscribers into another). `subscribe` is cheap enough that per-call is the
  simpler, safer default.

### 4. Returning the object straight from `getSnapshot`

```ts
const getSnapshot = (): ThemePreference => {
  const theme = window.matchMedia(QUERY).matches ? 'dark' : 'light';
  return {
    theme,
    isDarkMode: theme === 'dark',
    isLightMode: theme === 'light',
  };
};
```

- Simpler at first glance — one function instead of `getSnapshot` + `useMemo` —
  but every call allocates a new object, so `Object.is(prev, next)` is never
  `true` even when the OS preference hasn't changed. React's own documentation
  calls this out as a correctness bug (it can manifest as an infinite re-render
  loop), not just a performance concern. Rejected: violates
  `useSyncExternalStore`'s contract.

## Gotchas

- **`theme` is `undefined` until the client commits its first snapshot.** This
  is intentional (see above), not a bug — `isDarkMode` and `isLightMode` are
  both `false` in that window, so most consumers never need to check `theme`
  directly.
- **Does not persist or default a user override.** This hook reports the OS
  preference only; layering a manual light/dark toggle with `localStorage` (and
  falling back to this hook) is a separate concern for the consumer.
