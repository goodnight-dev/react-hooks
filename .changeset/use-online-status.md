---
'@goodnight-dev/react-hooks': minor
---

Add `useOnlineStatus`, a `useSyncExternalStore`-backed hook that reads the
browser's connectivity (`navigator.onLine`) and stays in sync on the `online` /
`offline` events. Returns `boolean | undefined` — `undefined` on the server and
until the client's first read — so a server render never guesses a client-only
value (a deliberate departure from React's own example, which defaults to
`true`; see `src/use-online-status.md`).
