# `useOnlineStatus`

> Read whether the browser currently has a network connection
> (`navigator.onLine`), staying in sync as it connects and disconnects.

## Chosen implementation

```ts
const subscribe = (onStoreChange: () => void): (() => void) => {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
};

const getSnapshot = (): boolean => navigator.onLine;
const getServerSnapshot = (): undefined => undefined;

export function useOnlineStatus(): boolean | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

Why this one:

- **`useSyncExternalStore`, and nothing more.** Connectivity is the textbook
  external store — so much so that it is the worked example in React's own
  [`useSyncExternalStore` docs](https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api).
  The browser maintains `navigator.onLine` and fires `online` / `offline` on
  `window` when it flips; there is nothing to poll and no promise to await, so
  `subscribe` is just two listeners and `getSnapshot` is a one-line read. This
  is also the only shape that is safe under concurrent rendering (see
  [ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md)).
- **`getServerSnapshot` returns `undefined`, _not_ `true`.** This is the one
  place this hook deliberately departs from React's documented example, which
  returns `true` ("always show Online for server-generated HTML"). That is a
  guessed default, and a client that hydrates while offline then flips from a
  server-rendered "online" to "offline" on the first commit — exactly the
  guessed-default flash
  [ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md) exists
  to refuse. `undefined` says "not known yet," identical to `useTheme`'s `theme`
  and `useWindowSize`'s dimensions, and lets a consumer render a neutral first
  paint instead of a maybe-wrong one. See alternative #1.
- **A bare `boolean | undefined`, not a `{ isOnline, isOffline }` object.**
  `useTheme` returns an object because it has genuinely distinct fields (`theme`
  plus two derived booleans); online status is a single binary fact, and
  `isOffline` would just be `!isOnline`. A second field buys nothing and, under
  the `undefined` state, actively misleads: `useTheme` can lean on "both
  booleans `false` ⇒ unknown," but `isOnline`/`isOffline` both-`false` reads as
  a contradiction rather than "unknown." A scalar keeps the tri-state honest and
  destructures to nothing. See alternative #3.
- **No caching `ref`.** `getSnapshot` returns a primitive `boolean`, which is
  already `Object.is`-stable across calls — so, unlike
  [`useWindowSize`](./use-window-size.md) and
  [`useLocalStorage`](./use-local-storage.md) (whose object / parsed snapshots
  need a cache to stay reference-stable), there is nothing to memoize here. Same
  as `useTheme`'s primitive `Theme`.
- **Both `online` and `offline` listeners, at module scope.** The two are
  distinct events — one fires on connect, the other on disconnect — so catching
  every transition needs both. And because `subscribe` / `getSnapshot` close
  over no per-call arguments, they are module-level constants shared across
  every hook instance, not closures rebuilt per render (contrast
  [`useLocalStorage`](./use-local-storage.md), whose `subscribe` must close over
  `key`). `navigator` is read unguarded for the same reason `useTheme` reads
  `window` unguarded — React guarantees `getSnapshot` / `subscribe` only run in
  the browser, a guarantee that holds only while they stay private, non-exported
  closures (see [use-theme.md](./use-theme.md)).

## Alternatives considered

### 1. `getServerSnapshot` returning `true` (React's own example)

```ts
const getServerSnapshot = (): boolean => true; // "always Online on the server"
```

- This is what React's documentation does, and it is a defensible call for their
  framing: `useSyncExternalStore` re-reads `getSnapshot` on the client
  immediately after hydration, so a wrong server guess self-corrects within one
  commit rather than sticking. Rejected here because this package's whole
  premise
  ([ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md)) is
  that "self-corrects within one commit" still means _one commit of the wrong
  thing_ — a visible flash for the offline-first user, who is precisely the one
  reaching for this hook. Returning `undefined` makes the "I don't know yet"
  state explicit in the return type instead of papering over it with an
  optimistic default, consistent with every other hook here. The cost is that
  consumers must handle a third state; that is the intended trade.

### 2. `useEffect` + `useState`

```ts
const [online, setOnline] = useState(() => navigator.onLine);
useEffect(() => {
  const update = () => setOnline(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);
```

Same shape as the rejected alternative in
[use-theme.md § 1](./use-theme.md#1-useeffect--usestate): the lazy `useState`
initializer reads `navigator` and throws during SSR unless guarded, and state
set from an effect can desync from a store change under concurrent rendering.
Rejected for the reasons in
[ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md).

### 3. Returning `{ isOnline, isOffline }` (the `useTheme` shape)

```ts
export function useOnlineStatus(): Readonly<{
  isOnline: boolean;
  isOffline: boolean;
}> { ... }
```

- Mirrors `useTheme`'s convenience-boolean object. Rejected because the analogy
  breaks on the one thing that makes `useTheme`'s version work: `useTheme` has a
  real tri-state scalar (`theme`) _plus_ derivations, and uses "both booleans
  `false`" as an unambiguous "unknown" signal. Online status is already a single
  boolean fact; `isOffline` is pure negation, and the both-`false` encoding that
  signals "unknown" in `useTheme` would here read as a contradictory "neither
  online nor offline." A scalar `boolean | undefined` carries the exact same
  information with no redundant field and an unambiguous unknown state.

### 4. An actual reachability check instead of `navigator.onLine`

Pinging a known endpoint (a `HEAD` request, a heartbeat, a long-lived socket)
and reporting _that_ as "online."

- Strictly more accurate — `navigator.onLine` only reports whether the browser
  has a network interface, not whether anything is reachable across it (see
  Gotchas). Rejected as the _default_ because it changes the hook's character
  entirely: it needs a URL to probe, an interval, timeout and back-off policy,
  and it generates network traffic as a side effect of rendering — all consumer
  decisions this package has no business hard-coding. This hook reports the
  browser's own cheap, event-driven signal; a consumer that needs true
  reachability should layer a probe on top (and can gate it on this hook's
  `false`, which _is_ reliable, to avoid probing when definitely offline).

### 5. The Network Information API (`navigator.connection`)

Reading `navigator.connection` for `effectiveType` / `downlink` / `saveData` to
report connection _quality_, not just presence.

- Answers a different question (how good is the connection, not whether there is
  one) and remains unevenly implemented across browsers. A `useNetworkState` /
  `useConnectionQuality` hook built on it would be a reasonable _separate_
  addition; folding it into a boolean "are we online" hook would overload a
  deliberately minimal surface.

## Gotchas

- **`true` is not a reachability guarantee.** `navigator.onLine === true` means
  the browser has _a_ network interface, not that the internet (or your API) is
  actually reachable: a captive portal, a VPN hiccup, or a dead upstream link
  all still read `true`. `false` is trustworthy ("definitely offline"); `true`
  means "probably online." Confirm with a real request where it matters
  (alternative #4).
- **`undefined` until the client commits its first snapshot.** Same contract as
  `useTheme`'s `theme` — branch on `undefined` before assuming online if a wrong
  first paint (e.g. hiding an offline banner the user needs) would be worse than
  rendering nothing for a frame.
