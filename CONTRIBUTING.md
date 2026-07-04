# Contributing

Thanks for your interest in `@goodnight-dev/react-hooks`. This repository
doubles as a showcase of how to build a modern, strict, well-packaged React
hooks library — so _how_ the code is written matters as much as _what_ it does.
These principles are the point of the project.

## Principles

### 1. SSR-safe and concurrent-safe by default

A hook must behave correctly outside a plain client-only render: under React's
concurrent features, and during server rendering / hydration.

- **Subscribe to external state with `useSyncExternalStore`**, not `useEffect` +
  `useState`. Anything living outside React — `matchMedia`, `localStorage`, a
  WebSocket, `window` dimensions — is a store, and `useSyncExternalStore` is the
  primitive React ships to read one without tearing under concurrent rendering.
- **Never guess a server value.** `getServerSnapshot` returns `undefined` (or
  another explicit "unknown yet" sentinel) rather than a default that risks a
  hydration mismatch. Pushing that decision to the consumer is correct; picking
  for them is not.
- **No unguarded browser globals at module or render scope.** `window`,
  `document`, and friends are read inside `subscribe` / `getSnapshot` functions,
  never at module top level, so importing the package never throws in a server
  environment.

### 2. Zero third-party runtime dependencies

A published hook must add **nothing** to a consumer's `node_modules` except our
own code and React itself.

- `react` is a **peer dependency only** — never a runtime `dependency`. A hooks
  library must use exactly the React instance the consumer's app is already
  running.
- No other runtime dependencies. `devDependencies` are unrestricted — they never
  ship to consumers.

### 3. Per-hook academic docs

A hook may carry a sibling Markdown file describing _how else it could be done_
and _why we chose what we chose_:

```
src/use-theme.ts
src/use-theme.md   ← sibling note
```

These are reference notes — and seeds for future blog posts — **not** API docs.
API docs are generated from the TSDoc comment on the hook itself. A good
per-hook note covers:

- the chosen implementation and its rationale,
- alternative implementations and why they were rejected,
- SSR / concurrency implications, and
- gotchas worth remembering.

Sibling `.md` files live in `src/` and are **not published to npm** — only
`dist/` ships (see the `files` field in `package.json`). They exist for the
repository and its author.

### 4. Every export tree-shakes

A consumer who imports one hook must bundle only that hook — never its siblings.

- **One hook per module**, re-exported from the barrel with a static
  `export { useX } from './useX.js'`. The unit a bundler keeps or drops is a
  single hook.
- **A subpath export per hook** (`@goodnight-dev/react-hooks/useTheme`), in
  addition to the barrel (`@goodnight-dev/react-hooks`). A consumer who wants a
  hard tree-shaking guarantee — not just trust in their bundler — can import the
  subpath directly and never touch the barrel module at all.
- **`"sideEffects": false`**, and no top-level side effects in any module.
- **Import siblings by file path, never through the barrel.** If one hook ever
  reuses another internally, write `import { useX } from './useX.js'`, not
  `from './index.js'` — routing internal reuse through the barrel couples a
  module to everything the barrel re-exports.

### 5. Rules of Hooks, enforced

`eslint-plugin-react-hooks` (`recommended`) runs as part of `pnpm lint` and
`pnpm check`, so a hook that violates the Rules of Hooks or has an incomplete
dependency array fails CI rather than shipping a subtle bug. Hooks that return
non-primitive values (objects, arrays, callbacks) should keep the reference
stable across renders where a consumer would reasonably depend on it — memoize
with `useMemo` / `useCallback` rather than returning a new identity on every
render.

### 6. Immutable public shapes

A hook's return value — and any props/options object a future hook accepts — is
a shape the consumer reads, never mutates in place.

- **Every property of an exported `interface` is `readonly`.** Enforced by
  `eslint-plugin-functional`'s `functional/type-declaration-immutability` rule
  (`eslint.config.js`) at `ReadonlyShallow`: a property missing `readonly` fails
  `pnpm lint`. The rule can only flag an interface, not autofix it — its fixer
  works by pattern-replacing a `type` alias's body, which is a single text
  expression; an interface's members are a structural list, so add the modifier
  by hand.
- **Wrap the type in `Readonly<...>` at the point a hook returns or accepts it**
  — e.g. `export function useTheme(): Readonly<ThemePreference>`. Once every
  member is already `readonly`, `Readonly<T>` is structurally redundant as far
  as the type checker is concerned — but it documents the contract at the
  function signature itself, visible without opening the interface, so the
  guarantee still reads correctly even if a later edit to the interface ever
  slipped on a member's `readonly`. Not lint-enforced: the only mechanical check
  available is a syntactic match against the literal `Readonly<...>` text, which
  produces false positives the moment a hook returns something that isn't a
  named interface (a tuple, a union, an inline object literal) — worse coverage
  than the previous bullet's real, type-checked property, for no type-safety
  gain of its own. Apply it by hand and hold it in review instead.

## Development

This is a [pnpm](https://pnpm.io) project; Node `>=22` (see `.nvmrc`).

```sh
pnpm install        # install dependencies
pnpm build          # build the package (tsdown)
pnpm test           # run the test suite (vitest)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (strictTypeChecked + react-hooks)
pnpm format         # prettier --check
pnpm check:exports  # publint + are-the-types-wrong
pnpm check          # everything above, in order
```

Run `pnpm check` before opening a pull request.

## Adding a hook

There is no scaffold yet (see the open tasks in
[`docs/recipes/adding-a-hook.md`](./docs/recipes/adding-a-hook.md)) — add the
files by hand:

1. Create `src/use-<name>.ts` (kebab-case filename, camelCase export — e.g.
   `use-local-storage.ts` exporting `useLocalStorage`) with a thorough TSDoc
   comment (summary, `@returns`, `@example`), implemented per §1 — SSR-safe, no
   unguarded browser globals.
2. Add `src/use-<name>.test.ts` covering the initial value, updates, and cleanup
   on unmount.
3. Re-export it from `src/index.ts`. This is the step that makes it importable
   from the barrel, and the easiest to skip — `pnpm check` still passes without
   it.
4. Add it to `src/index.test.ts` so a forgotten re-export fails the build
   instead of shipping.
5. Add a subpath export for it in `package.json`'s `exports` map and an entry
   point in `tsdown.config.ts` (§4).
6. Add the hook to this README's API section (hand-maintained, so a new export
   is invisible to consumers until you do).
7. If the implementation has interesting alternatives, add `src/use-<name>.md`
   (§3).
8. Run `pnpm check`, then add a changeset: `pnpm changeset`.

For the full walkthrough, see the [recipes](./docs/recipes/):

- [Adding a hook](./docs/recipes/adding-a-hook.md)
- [Cutting a release](./docs/recipes/cutting-a-release.md)

## Branching & pull requests

Every change lands on `main` through a pull request. There is no direct push to
`main` outside of the one-time repo bootstrap.

### Branching

Branch off `main`, named:

```
<type>/<short-slug>
```

or, when the work is tracked by an open GitHub issue:

```
<type>/<issue-number>-<short-slug>
```

`<type>` matches the Conventional Commits type of the change (`feat`, `fix`,
`chore`, `docs`, `refactor`, …). One unit of work per branch, one branch per PR
— keep it small enough to review in a sitting.

Examples: `feat/42-use-media-query`, `fix/use-theme-listener-leak`,
`docs/branching-and-pr-conventions`.

### Referencing an issue

If the work closes or relates to an open issue:

- Every commit on the branch gets a `Refs: #<number>` trailer, so the connection
  is traceable from `git log` alone, independent of GitHub.
- The **PR body** — not the commit body — includes `Closes #<number>` (or
  `Fixes #<number>` for a bug fix), so GitHub closes the issue automatically on
  merge.

Keeping the closing keyword out of commit trailers is deliberate: a commit that
merely references an issue shouldn't auto-close it before the rest of the PR has
landed. The PR body is the one place that actually triggers closure, and it only
fires once, on merge to `main`.

### Pull requests

1. Push the branch and open a PR against `main`. Fill in the PR template
   honestly — every checkbox is something CI or a reviewer would otherwise have
   to catch by hand.
2. `pnpm check` must pass locally before you open the PR; CI re-runs it across
   the full Node matrix (see [`ci.yml`](.github/workflows/ci.yml)).
3. **Merge with rebase** once CI is green and the PR is approved — the default
   and preferred method here, matching
   [`@goodnight-dev/utils`](https://github.com/goodnight-dev/utils). It replays
   your commits onto `main` individually rather than collapsing them into a
   merge or squash commit, keeping a linear, readable history where each commit
   still stands on its own.

`main` is protected by a repository ruleset: required status checks, linear
history, and pull requests are enforced technically, not just by convention.

## Commit conventions

Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/) and are
**enforced** by `commitlint` on the `commit-msg` git hook. The hooks are wired
up with [lefthook](https://lefthook.dev) and installed automatically by the
`prepare` script when you run `pnpm install`.

Format:

```
<type>(<optional scope>): <description>
```

- **type** — `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`, …
- **scope** (optional, encouraged) — the affected hook or area: `use-theme`,
  `repo`, `ci`, `deps`.

```
feat(use-theme): add useTheme
fix(use-theme): clean up the change listener on unmount
docs(use-theme): expand use-theme.md notes
chore(repo): bump dev dependencies
```

> **Conventional commits here are for history hygiene only — they do _not_ drive
> version numbers.** Version bumps are declared explicitly with Changesets (see
> below). Rationale:
> [docs/adr/0001-versioning-and-commit-conventions.md](./docs/adr/0001-versioning-and-commit-conventions.md).

The `pre-commit` hook also runs Prettier and ESLint (`--fix`) on staged files.

## Versioning & releases

[Changesets](https://github.com/changesets/changesets) is the **single source of
truth** for version bumps.

Workflow:

1. Make your change and commit it with a conventional-commit message.
2. Run `pnpm changeset`, pick the bump level (patch / minor / major), and write
   a short summary. This writes a markdown file under `.changeset/`.
3. Commit that changeset alongside your change.

At release time, `pnpm version-packages` (`changeset version`) consumes the
accumulated changesets: it bumps the package version and regenerates
`CHANGELOG.md`. `pnpm release` then builds and publishes over OIDC — see
[docs/adr/0002-oidc-trusted-publishing.md](./docs/adr/0002-oidc-trusted-publishing.md)
for why that isn't plain `changeset publish`.
