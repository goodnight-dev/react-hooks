# `useWindowSize`

> Read the browser viewport's `width` and `height`, staying in sync as the
> window is resized.

## Chosen implementation

```ts
export function useWindowSize(): Readonly<WindowSize> {
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
```

Why this one:

- **`{ width, height }`, each individually `number | undefined`, not
  `WindowSize | undefined` for the whole return.** The alternative — returning
  `undefined` until the client has measured — forces every consumer to
  null-check the whole object before it can destructure at all:
  `const size = useWindowSize(); if (!size) return null; const { width } = size;`.
  Always returning the shape and pushing "unknown yet" down to each field lets a
  consumer destructure immediately (`const { width, height } = useWindowSize()`)
  and only branch on `undefined` where it actually matters, matching
  `useTheme`'s own `ThemePreference` — `isDarkMode` / `isLightMode` are always
  present booleans, and only `theme` itself carries the `| undefined`. Both
  fields resolve together in practice (they're read from the same snapshot), so
  there's no real risk of one being defined while the other isn't.
- **A per-instance cache (`useRef`), not a shared module-level one.** Unlike
  `useTheme`'s primitive `Theme` snapshot, `{ width, height }` is a compound
  object — `useSyncExternalStore` requires `getSnapshot` to return the same
  reference across calls when nothing changed (see
  [ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md)), so
  something has to cache it, the same problem `useLocalStorage` solves with a
  parse cache. `window.innerWidth` / `innerHeight` really is one global value,
  so a single module-level cache shared across every `useWindowSize()` call
  would be an accurate model, not a hack — but it's a second, subtly different
  caching idiom for what every other stateful piece in this package does with a
  `useRef`, and it buys nothing measurable (a few extra small objects on resize
  is not a real cost). Consistency with the rest of the package won out; see
  alternative #3.
- **`window.innerWidth` / `innerHeight`, not
  `document.documentElement.clientWidth` / `clientHeight`.** The former includes
  the scrollbar's width where present; the latter excludes it. For "how big is
  my viewport" — the usual reason to reach for this hook — `innerWidth` /
  `innerHeight` is what most consumers mean. See alternative #4 if you
  specifically need the scrollbar-excluded value.
- **Listens to `resize` directly, no throttling.** `resize` can fire many times
  a second while a window is being dragged. This hook does not throttle or batch
  those events — see alternative #5 for why.
- **`getServerSnapshot` returns a shared `const`, not a fresh object per call.**
  Its value never changes (there is no viewport on the server), so there's
  nothing to cache against the way `getSnapshot` does — one constant is simpler
  and cheaper than reallocating `{ width: undefined, height: undefined }` every
  time React calls it.

## Alternatives considered

### 1. Return `WindowSize | undefined`, gating the whole object on mount

```ts
export function useWindowSize(): Readonly<WindowSize> | undefined { ... }
```

- Mirrors `useTheme`'s all-or-nothing `theme` field, but at the level of the
  whole return value instead of one field within it. Forces a null-check before
  destructuring anything, even `width` alone, which is the ergonomics complaint
  that motivated the chosen shape. Rejected: `theme` is a single scalar with
  only two live values (a single flag really is all-or-nothing), while `width`
  and `height` are two independent numbers a consumer may want to destructure
  together — the per-field `| undefined` generalizes better here.

### 2. `useEffect` + `useState`

Same shape as the rejected alternative in
[`use-theme.md`](./use-theme.md#1-useeffect--usestate): a lazy `useState`
initializer that reads `window.innerWidth` throws during SSR unless guarded, and
a `resize` handler that calls `setState` from an effect can desync from a store
update under concurrent rendering. Rejected for the same reasons `useTheme`
rejects it — see
[ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md).

### 3. A shared module-level cache instead of a per-instance `useRef`

```ts
let cache: WindowSize | null = null;
const getSnapshot = (): WindowSize => {
  /* compare against and update the shared `cache` */
};
```

- Would save a handful of small object allocations when many components call
  `useWindowSize()` at once, and is arguably the more "honest" model — there is
  only one `window`. Rejected in favor of the `useRef` version purely for
  consistency: it's the same caching shape `useLocalStorage` already uses in
  this package, and introducing a second, module-scoped variant for what looks
  like the same problem is a worse trade than the tiny efficiency gain,
  especially since resizes are rare relative to renders.

### 4. `document.documentElement.clientWidth` / `clientHeight`

- Excludes the scrollbar, which is sometimes exactly what's wanted (e.g. laying
  out content meant to fill the visible area precisely). Not chosen as the
  default because `innerWidth` / `innerHeight` is the more common interpretation
  of "window size" and what most consumers reaching for a hook named
  `useWindowSize` expect; a `useViewportSize` (or similar) hook reading
  `clientWidth` / `clientHeight` would be a reasonable, separate addition if a
  concrete need for it shows up.

### 5. Throttle or debounce the resize listener (e.g. via `requestAnimationFrame`)

- Common in hand-rolled versions of this hook, since `resize` can fire far more
  often than the browser repaints while a window is being dragged. Rejected as
  the default: `useSyncExternalStore` already only commits a render when React
  gets around to it, React 18+ batches the synchronous updates that follow, and
  adding a `requestAnimationFrame` (or timer) hop trades a small,
  well-understood latency (one commit per native event) for a larger,
  hook-specific one (one commit per animation frame, plus whatever a debounce
  window adds) that a consumer doing real-time layout work during a drag may not
  want. A consumer with many expensive re-renders on `resize` can throttle at
  the call site (e.g. wrap the _consumer's_ expensive work, not this hook's
  subscription) without this hook imposing that trade-off on everyone.

### 6. Also listen for `orientationchange` / `visualViewport.resize`

- Mobile browsers fire a plain `resize` on orientation change and on-screen
  keyboard show/hide in every current engine, which is why this hook doesn't
  need a second listener for either case today. `window.visualViewport` is the
  more precise source for the on-screen-keyboard case specifically (it reports
  the visible area, `resize` reports the layout viewport, and the two diverge
  when a virtual keyboard is up) — a reasonable addition, or a separate
  `useVisualViewport` hook, if that distinction ever matters to a consumer.

## Gotchas

- **`width` and `height` are `undefined` until the client commits its first
  snapshot.** Same contract as `useTheme`'s `theme` — check for `undefined`
  before laying out against either value if a wrong first paint (e.g. `0` or a
  guessed default) would be worse than rendering nothing.
- **Fires on every `resize` event, unthrottled.** Fine for typical usage
  (conditional rendering, breakpoint checks); a consumer doing expensive work on
  every update during an active window drag should debounce or throttle that
  work itself (see alternative #5).
