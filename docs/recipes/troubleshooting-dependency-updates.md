# Recipe: troubleshooting dependency-update CI failures

A recurring failure mode on Dependabot npm PRs: CI fails at
`pnpm install --frozen-lockfile` with a `401 Unauthorized` while fetching a
package from GitHub Packages (`npm.pkg.github.com`).

## Symptom

A Dependabot PR fails the `check` jobs almost immediately — before any lint,
build, or test runs — with:

```
ERR_PNPM_FETCH_401  GET https://npm.pkg.github.com/download/<pkg>/<version>/<hash>: Unauthorized - 401
```

The repo has no `.npmrc` pointing at GitHub Packages, and the lockfile looks
fine at a glance. The [CI guard](../../.github/workflows/ci.yml) catches this
case and fails fast with a pointer to this recipe.

## Cause

When Dependabot regenerates `pnpm-lock.yaml` it resolves dependencies behind its
own registry proxy. For a package that is **newly added** to the lockfile — a
new direct or transitive dependency — it can write a `tarball:` URL that points
at GitHub Packages instead of the public registry:

```yaml
'@types/jsesc@2.5.1':
  resolution:
    integrity: sha512-…
    tarball: https://npm.pkg.github.com/download/@types/jsesc/2.5.1/<hash>
```

pnpm's lockfile format persists that `tarball:` field, so
`pnpm install --frozen-lockfile` fetches from that exact URL. CI has no GitHub
Packages credentials (the workflow grants only `contents: read`), so the fetch
returns 401.

Only newly-added packages are affected. Plain version bumps of packages already
in the lockfile keep their existing, correct resolution lines, so most
Dependabot PRs are unaffected.

## Fix

The injected `integrity` hash is correct — it matches the public-registry
tarball — so only the `tarball:` URL is wrong. Drop it and let pnpm fall back to
the default registry.

1. Check out the PR branch:

   ```sh
   gh pr checkout <number>
   ```

2. Find the offending entries and remove the bad `tarball:` field, leaving
   `integrity` intact:

   ```sh
   grep -n 'npm.pkg.github.com' pnpm-lock.yaml
   ```

   Delete the `, tarball: https://npm.pkg.github.com/…` fragment from each
   match. Note that `pnpm install --lockfile-only` will **not** fix this on its
   own — pnpm trusts the existing resolution and reuses it, so you have to
   remove the bad field by hand first.

3. Reproduce a clean CI install, then run the full check:

   ```sh
   pnpm install --frozen-lockfile
   pnpm check
   ```

4. Commit and push to the PR branch. Pushing stops Dependabot from auto-managing
   the branch, which is fine — the PR is ready to merge once CI is green:

   ```sh
   git commit -am 'chore(deps): resolve <pkg> from the public npm registry'
   git push
   ```

## Why not prevent it instead?

Pinning the registry in `dependabot.yml` (a `registries:` block) has mixed
reports on whether it stops the tarball-URL injection, and auto-fixing in CI
would need a workflow that pushes to Dependabot branches with elevated
permissions. Neither is worth it at this frequency. The CI guard keeps the
failure cheap to diagnose, and the manual fix above takes under a minute.
