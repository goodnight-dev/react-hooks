# Recipe: adding a hook

How to add a new hook to the package — for example, `useTheme`. There is no
scaffold generator yet (unlike the plop-based `pnpm new` in the sibling
[`@goodnight-dev/utils`](https://github.com/goodnight-dev/utils) repo); a
generator is a reasonable addition once there are enough hooks to justify one.
Replace `useTheme` below with your hook's name.

## Checklist

**Step 0, before anything below: branch off `main`.**
`git switch -c <type>/use-<name>` (e.g. `feat/use-media-query`). `main` is
protected — a direct push is rejected, and every change lands through a PR (see
[CONTRIBUTING § Branching & pull requests](../../CONTRIBUTING.md#branching--pull-requests)).
It's numbered 0 because it's the one misstep the rest of this list can't catch
for you: `pnpm check` is exactly as green on `main` as on a branch, so nothing
downstream will flag it.

Every step matters, but step 3 is the one that bites: a hook can be written,
tested, documented, and released while still being **unreachable** by consumers,
because nothing fails. Treat the barrel and the entry-point test as part of
"done," not paperwork.

- [ ] 0. **Branch off `main`** — `git switch -c <type>/use-<name>` (never commit
      to `main` directly)
- [ ] 1. Source file with thorough TSDoc — `src/use-theme.ts`
- [ ] 2. Tests covering the initial value, updates, and unmount cleanup —
      `src/use-theme.test.ts`
- [ ] 3. **Re-export from the barrel** — `src/index.ts` (the step that makes it
      importable, and the one that still passes `pnpm check` if skipped)
- [ ] 4. **Add it to the entry-point test** — `src/index.test.ts` (fails until
      you do: the auto-added export is now in the surface, so the test goes red)
- [ ] 5. **Add a subpath export** in `package.json`'s `exports` map and an entry
      in `tsdown.config.ts`'s `entry` array
- [ ] 6. (Optional) implementation notes — `src/use-theme.md`
- [ ] 7. Update the README's API table
- [ ] 8. `pnpm check`, then `pnpm changeset` (a new hook is a `minor` bump)
- [ ] 9. Conventional-commit + PR

## 1. Write the source

Follow the SSR-safe shape from
[ADR 0003](../adr/0003-ssr-safe-external-store-subscriptions.md): if the hook
reads anything outside React (a browser API, storage, a socket), build it on
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`, with
`getServerSnapshot` returning an explicit "not known yet" value rather than a
guessed default. `src/use-theme.ts` is the worked example.

Write a thorough TSDoc comment — summary, `@returns`, and an `@example` — it's
what renders in the
[API reference](https://goodnight-dev.github.io/react-hooks/).

## 2. Write the tests

Cover: the value on first render, that it updates when the underlying store
fires a change event, and that the listener is removed on unmount. `jsdom`
doesn't implement most browser APIs (e.g. `matchMedia`) — mock the minimal
surface your hook needs; `src/use-theme.test.ts` is the worked example.

## 3–4. Wire up the barrel

```ts
// src/index.ts
export type { Theme } from './use-theme.js';
export { useTheme } from './use-theme.js';
```

Then add the new export's name to the sorted array in `src/index.test.ts`'s
"exports exactly the documented public surface" test.

## 5. Add a subpath export

```jsonc
// package.json
"exports": {
  ".": { "types": "./dist/index.d.mts", "import": "./dist/index.mjs" },
  "./useTheme": { "types": "./dist/use-theme.d.mts", "import": "./dist/use-theme.mjs" },
  "./package.json": "./package.json"
}
```

```ts
// tsdown.config.ts
entry: ['src/index.ts', 'src/use-theme.ts'],
```

## 6–9. Document, check, release

Add `src/use-theme.md` if the implementation has interesting alternatives (see
[CONTRIBUTING.md §3](../../CONTRIBUTING.md)), update the README's API table, run
`pnpm check`, and add a changeset with `pnpm changeset` — a new hook is a
`minor` bump.
