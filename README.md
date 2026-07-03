# @goodnight-dev/react-hooks

Small, strict, modern React hooks — the ones you end up writing in every
project, packaged the right way.

[![npm](https://img.shields.io/npm/v/@goodnight-dev/react-hooks)](https://www.npmjs.com/package/@goodnight-dev/react-hooks)
[![CI](https://github.com/goodnight-dev/react-hooks/actions/workflows/ci.yml/badge.svg)](https://github.com/goodnight-dev/react-hooks/actions/workflows/ci.yml)
[![docs](https://img.shields.io/badge/docs-online-blue)](https://goodnight-dev.github.io/react-hooks/)

> **Status:** bootstrapping — the packaging, CI, docs, and release pipeline are
> in place; the hook surface is still one hook and growing. As much a showcase
> of hook-packaging best practices as a hooks library.

## Install

```sh
pnpm add @goodnight-dev/react-hooks
```

Requires React `>=19`.

## Two ways to import

```ts
// 1. Barrel — everything from one entry point.
import { useLocalStorage, useTheme } from '@goodnight-dev/react-hooks';

// 2. Subpath — smallest possible import, no barrel involved at all.
import { useTheme } from '@goodnight-dev/react-hooks/useTheme';
import { useLocalStorage } from '@goodnight-dev/react-hooks/useLocalStorage';
```

Both are fully typed, ESM-only, and tree-shakable.

## API

| Hook                            | Description                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `useTheme()`                    | Reads the OS `prefers-color-scheme`, live-updating on change.                      |
| `useLocalStorage(key, initial)` | Reads and writes a JSON-serializable value in `localStorage`, syncing across tabs. |

```tsx
import { useLocalStorage, useTheme } from '@goodnight-dev/react-hooks';

// Module scope: created once when this file loads, never re-allocated on
// render, so there's nothing to memoize.
const defaultSettings = { seen: false };

function App() {
  const { theme, isDarkMode } = useTheme();
  const [settings, setSettings] = useLocalStorage(
    `users-${userId}`,
    defaultSettings,
  );

  if (theme === undefined) return null; // avoid a flash of the wrong theme
  return (
    <div data-theme={theme}>
      {isDarkMode ? '🌙' : '☀️'}
      <button onClick={() => setSettings((s) => ({ ...s, seen: true }))}>
        Dismiss
      </button>
    </div>
  );
}
```

See [`src/use-theme.md`](./src/use-theme.md) and
[`src/use-local-storage.md`](./src/use-local-storage.md) for the design
rationale behind each.

## Project goals

- 100% TypeScript with declaration files generated for consumers
- Modern ESM only, React `>=19` peer dependency
- SSR-safe and concurrent-safe: every hook is built on `useSyncExternalStore`
  where it subscribes to something outside React
- Strictest practical linting + formatting (typescript-eslint
  `strictTypeChecked`, `eslint-plugin-react-hooks`, Prettier)
- Importable as a whole or by tree-shakable subpath, per hook
- Comprehensive generated API docs
- **Zero third-party runtime dependencies**

## Principles

This repo is opinionated about _how_ the code is written. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the full rationale; in short:

- **SSR-safe and concurrent-safe by default.** External state (browser APIs,
  storage, sockets) is read through `useSyncExternalStore`, never `useEffect` +
  `useState`. A server render never guesses a client-only value.
- **Zero third-party runtime dependencies.** Installing this package adds
  nothing to your `node_modules` but our own code — React itself is a peer
  dependency.
- **Per-hook notes.** Hooks carry a sibling `*.md` (repo-only, academic)
  explaining alternative implementations and why we chose ours — e.g.
  [`use-theme.md`](./src/use-theme.md).

## Development

This is a [pnpm](https://pnpm.io) project. Requires Node `>=22`.

```sh
pnpm install        # install dependencies
pnpm build          # build the package (tsdown)
pnpm test           # run the test suite (vitest)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm format         # prettier --check
pnpm check          # everything: format, lint, build, typecheck, test, exports
pnpm docs:build     # generate the API docs site (TypeDoc)
```

## Documentation

- **[API reference](https://goodnight-dev.github.io/react-hooks/)** — generated
  from TSDoc comments.
- **[`docs/`](./docs/)** — recipes (adding a hook, cutting a release) and
  architecture decision records.

## License

[MIT](./LICENSE) © Ian Goodnight
