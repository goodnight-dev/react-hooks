---
'@goodnight-dev/react-hooks': minor
---

Add `useWindowSize`, a `useSyncExternalStore`-backed hook that reads the
viewport's `width` and `height` and stays in sync on resize. Each dimension is
`number | undefined` — `undefined` on the server and until the client's first
measurement — so consumers can destructure immediately and only branch on the
unknown state where it matters.
