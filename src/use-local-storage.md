# `useLocalStorage`

> Read and write a JSON-serializable value in `localStorage`, keyed by a string,
> re-rendering on change — including changes made from another tab.

## Chosen implementation

Returns a `[value, setValue]` tuple — the same shape as `useState` — rather than
a mutable, auto-saving object.

Why this one:

- **`[value, setValue]`, not a mutate-in-place proxy.** A design like
  `const settings = useLocalStorage(key); settings.theme = 'dark'` (a MobX-style
  observable) needs either MobX's own reactive rendering system or a hand-rolled
  deep-proxy that intercepts every nested property write, special-cases arrays,
  and re-serializes the whole value on each mutation. That's a lot of fragile
  surface area for a zero-dependency package, and it fights React's model: React
  only re-renders when told to via a state update, and a raw property write on a
  returned object tells it nothing. Mirroring `useState`'s tuple keeps exactly
  one write path — every React developer already knows how to use it.
- **`localStorage` is the single source of truth; nothing is cached in React
  state.** `getSnapshot` re-reads `localStorage` on every call rather than
  keeping a parallel copy in `useState`, so there's no second copy to get out of
  sync — same architecture as `useTheme`, which never caches
  `matchMedia().matches` either.
- **The functional-update form of `setValue` reads through `getSnapshot()`, not
  a closed-over render value.** Because the store, not React state, is
  authoritative, `setValue((previous) => ...)` always sees what's actually
  stored right now, even across rapid successive calls in the same tick —
  there's no stale-closure risk the way there can be with `useState`'s updater
  form if it read from a render-scoped variable instead.
- **A parse cache keeps `getSnapshot` reference-stable.** `useSyncExternalStore`
  requires `getSnapshot` to return the same reference across calls when nothing
  changed (see
  [ADR 0003](../docs/adr/0003-ssr-safe-external-store-subscriptions.md)) —
  `JSON.parse` alone can't satisfy that, since it allocates a new object every
  call. `getSnapshot` caches the last parsed value against the raw string it
  came from, and only reparses (producing a new reference) when that raw string
  actually changed. The cache isn't reset when `key` changes — the raw string
  for a different key almost never matches what's cached, so it naturally
  reparses instead of returning a stale value from the previous key.
- **Cross-tab and same-tab updates share one `subscribe` path.** The native
  `storage` event only fires in _other_ tabs/windows, never the one that made
  the write — browsers don't notify a document of its own change. So `setValue`
  dispatches a same-tab custom event after a successful write, and `subscribe`
  listens for both that and real `storage` events, treating them identically
  once filtered to the relevant key.
- **`initialValue` is only honored the first time a key is empty — same contract
  as `useState`.** Passing a fresh value on a later render doesn't overwrite
  what's already stored, matching how `useState(initialValue)` only reads its
  argument on the very first render. If you pass an object or array literal,
  memoize it yourself if you care about avoiding the extra allocation each
  render; it doesn't affect correctness.
- **No auto-vivification.** Reading a key that doesn't exist yet returns
  `initialValue` without writing anything to `localStorage` — writing during
  render would be a side effect React explicitly disallows. Only `setValue`
  persists. If you want a key populated the moment a component mounts, call
  `setValue(initialValue)` yourself in a `useEffect`.

## SSR behavior

Unlike `useTheme` (which has no sensible default and returns `undefined` until
resolved), `getServerSnapshot` here returns `initialValue` directly — there is
always a caller-supplied fallback, so there's no "unknown" state to represent.
The trade-off: if `localStorage` already holds a _different_ value than
`initialValue`, the client's first paint briefly shows `initialValue` and then
updates to the real stored value right after mount, rather than rendering
`undefined` and letting the consumer choose what to show meanwhile. For a
settings object this is normally an acceptable one-frame flash; if a consumer
needs to avoid it entirely, they can render nothing until an effect confirms the
client has mounted — the same trade-off any `localStorage`-backed hook has to
make.

## Alternatives considered

### 1. Mutate-in-place observable object

```ts
const settings = useLocalStorage(key, defaults);
settings.theme = 'dark'; // intended to auto-persist and re-render
```

- Requires a deep Proxy (or MobX itself) to intercept arbitrary nested writes
  and array mutators, plus a way to notify React a mutation happened — React has
  no built-in hook into "someone wrote to this object." Rejected: far more
  implementation surface than a zero-dependency hooks package should carry for
  one hook, and it fights React's update model instead of using it.

### 2. Cache the value in `useState`, write-through to `localStorage`

```ts
const [value, setValue] = useState(() => readFromStorage(key, initialValue));
const set = (next) => {
  setValue(next);
  localStorage.setItem(key, JSON.stringify(next));
};
```

- Two copies of the truth (React state and `localStorage`) that can drift — e.g.
  a cross-tab `storage` event has to remember to call `setValue` too, and any
  future write path that forgets to update both is a real bug. Rejected in favor
  of `useSyncExternalStore` reading `localStorage` directly, which makes drift
  structurally impossible.

### 3. Rely only on the native `storage` event

- Doesn't fire in the tab that made the change, so a component in the same tab
  that called `setValue` would not see its own update reflected without a
  separate mechanism. Rejected as incomplete on its own; kept as the cross-tab
  half of `subscribe`, paired with a same-tab custom event.

## Gotchas

- **Values must be JSON-serializable.** Plain objects, arrays, strings, numbers,
  booleans, and `null` round-trip correctly; `Date`, `Map`, `Set`, functions,
  and class instances do not survive `JSON.stringify` / `JSON.parse` unchanged.
- **A failed write is reported, not silently swallowed.** If `localStorage`
  throws (quota exceeded, disabled in the current context), `setValue` logs a
  warning and leaves the stored value untouched, rather than letting the caller
  believe the write succeeded.
- **`localStorage.clear()` is treated as affecting every key.** The native
  `storage` event fires with `key: null` for a clear, and every subscriber
  treats that as "my key may have changed" rather than ignoring it.
