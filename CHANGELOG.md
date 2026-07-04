# @goodnight-dev/react-hooks

## 0.3.0

### Minor Changes

- 1e2c3c7: Add `useWindowSize`, a `useSyncExternalStore`-backed hook that reads
  the viewport's `width` and `height` and stays in sync on resize. Each
  dimension is `number | undefined` — `undefined` on the server and until the
  client's first measurement — so consumers can destructure immediately and only
  branch on the unknown state where it matters.

### Patch Changes

- 7b85d35: `ThemePreference`'s members are now `readonly`, and `useTheme`
  returns `Readonly<ThemePreference>`. The returned object was never meant to be
  mutated in place; the types now say so. No runtime behavior changes.

## 0.2.0

### Minor Changes

- 9851577: Add `useLocalStorage`, a `useSyncExternalStore`-backed hook for
  reading and writing a JSON-serializable value in `localStorage`, staying in
  sync across tabs.

## 0.1.0

### Minor Changes

- be1960a: Initial bootstrapping and publishing flow, with `useTheme`.
