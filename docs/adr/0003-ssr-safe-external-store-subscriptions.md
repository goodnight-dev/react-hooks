# 3. SSR-safe external-store subscriptions as the default hook shape

- **Status:** Accepted
- **Date:** 2026-07-03

## Context

Every hook this package will ever add follows the same shape: read a piece of
state that lives outside React — a media query, `localStorage`, a WebSocket,
`window` dimensions — and re-render when it changes. The obvious first
implementation is `useEffect` + `useState`:

```ts
const [value, setValue] = useState(() => readExternalValue());
useEffect(() => {
  const handler = () => setValue(readExternalValue());
  externalStore.addEventListener('change', handler);
  return () => externalStore.removeEventListener('change', handler);
}, []);
```

This has two problems that only show up under conditions easy to miss in local
development:

1. **Tearing under concurrent rendering.** React can render a component tree
   more than once for a single update, or interleave rendering with other work.
   If the external value changes between renders, `useEffect` + `useState` can
   let different parts of the tree observe different values of the same external
   state in what should be one consistent render.
2. **No SSR story.** `readExternalValue()` typically touches `window` /
   `document`, which don't exist on the server. A lazy `useState` initializer
   that calls it unconditionally throws during server rendering, and any fix
   that guesses a default (e.g. always `'light'` for a theme) causes a hydration
   mismatch whenever the guess is wrong — visible to users as a flash of the
   wrong UI, and to React as a hydration error in the console.

## Decision

Every hook in this package that subscribes to state outside React is built on
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`:

- `subscribe` attaches a listener to the external store and returns the cleanup
  — no state, no effect timing to reason about.
- `getSnapshot` reads the current value. React calls it as needed and compares
  by reference/value to decide whether to re-render, and guarantees a consistent
  read across a single render pass — this is what closes the tearing gap above.
- `getServerSnapshot` returns an explicit "not known yet" value (e.g.
  `undefined`) rather than a guessed default. See
  [`use-theme.md`](../../src/use-theme.md) for the concrete case: guessing
  `'light'` on the server is a coin flip against the client's real
  `prefers-color-scheme`, and `useSyncExternalStore` reruns `getSnapshot` on the
  client immediately after the first commit, so the "unknown" state is visible
  for at most one paint, not indefinitely.

This is a repo-wide convention, not a per-hook decision: a new hook that reads
external state and is **not** written this way should be treated as a bug, the
same way a violation of the Rules of Hooks would be.

One consequence worth stating explicitly: `subscribe` and `getSnapshot` can
reference `window` / `document` **unguarded**, with no `typeof window` check.
That's not an oversight — it holds only because React itself guarantees
`getSnapshot` and `subscribe` never run during server rendering
(`getServerSnapshot` runs instead), which in turn depends on `subscribe` and
`getSnapshot` staying private, non-exported closures that nothing calls except
the `useSyncExternalStore` invocation itself. A hook that ever exposes either
function directly (e.g. a synchronous "read once" escape hatch) breaks that
guarantee and needs its own guard.

## Alternatives considered

- **`useEffect` + `useState`, accepted as "good enough."** Works for a component
  that only ever renders on the client with no concurrent features in play.
  Rejected as the package default because that assumption is exactly the kind of
  thing a consumer's app can silently violate later (adopting `<Suspense>`,
  moving to streaming SSR) — at which point the bug shows up in their code, not
  this package's.
- **A single, module-level subscription shared across all hook instances.**
  Would reduce the number of underlying event listeners, but couples every
  consumer's lifecycle to shared module state, which complicates both testing
  and multi-request server environments. See
  [`use-theme.md`](../../src/use-theme.md) alternative #3 for the concrete
  version of this trade-off.

## Consequences

- Every hook that wraps a browser API needs three small functions (`subscribe`,
  `getSnapshot`, `getServerSnapshot`) instead of one `useEffect`. Slightly more
  boilerplate per hook, in exchange for correctness that doesn't depend on the
  consumer's rendering mode.
- Hooks are safe to use from a server-rendered app without special-casing — the
  "what do I render before I know" decision is explicit in the hook's return
  type (e.g. `Theme | undefined`), not hidden behind a guessed default.
- New hooks should default to this shape; a plain `useEffect` + `useState`
  subscription is the exception that needs justifying, not the norm.
