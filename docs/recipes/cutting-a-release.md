# Recipe: cutting a release

Releases are automated with
[Changesets](https://github.com/changesets/changesets) and published to npm via
**Trusted Publishing (OIDC)** with provenance — no stored token. See
[ADR 0001](../adr/0001-versioning-and-commit-conventions.md) for the rationale.

## The normal flow

1. **Every PR that changes the published package includes a changeset.** Run
   `pnpm changeset`, pick the bump level (`patch` / `minor` / `major`), and
   write a one-line summary. Commit the generated `.changeset/*.md` file
   alongside your change.

2. **Merge your PR(s) to `main`.** The `Release` workflow sees the pending
   changeset(s) and opens (or updates) a **"Version Packages" PR** that bumps
   the version and regenerates `CHANGELOG.md`.

3. **Review and merge the "Version Packages" PR.** On merge, the workflow
   publishes to npm over OIDC, with provenance.

   The publish is done by
   [`scripts/release-publish.mjs`](../../scripts/release-publish.mjs) rather
   than `changeset publish` — `changeset publish` doesn't drive npm's OIDC
   handshake. The script packs the package with `pnpm pack` and runs
   `npm publish` on the tarball, which performs the OIDC auth and provenance. It
   then tags the published version (`name@version`) and opens a matching
   **GitHub Release** with notes taken from `CHANGELOG.md`. See
   [ADR 0002](../adr/0002-oidc-trusted-publishing.md).

In the normal flow you never run `npm publish` by hand.

## One-time setup

### a. Let the workflow open the Version PR

The `Release` workflow opens the "Version Packages" PR with the workflow token,
which GitHub blocks by default. Enable it **once** (both levels, org first):

- **Org:** `https://github.com/organizations/goodnight-dev/settings/actions` →
  _Workflow permissions_ → check **"Allow GitHub Actions to create and approve
  pull requests."**
- **Repo:** _Settings → Actions → General_ → the same checkbox — or
  `gh api --method PUT repos/goodnight-dev/react-hooks/actions/permissions/workflow -F can_approve_pull_request_reviews=true -f default_workflow_permissions=read`.

### b. Bootstrap the package onto npm

A package can't be "trusted" before it exists, so the **first** publish is a
one-time manual bootstrap:

```sh
npm login
pnpm publish --access public
```

- This bootstrap has **no provenance** — provenance is generated only by the CI
  release workflow (`npm publish --provenance` over OIDC). That's expected; the
  bootstrap version just exists to create the package. (Do **not** put
  `provenance: true` in `publishConfig`, or local publishes fail with "provider:
  null".)

### c. Configure the trusted publisher

On npmjs.com, open the package → **Settings → Trusted Publisher** and add:

- Provider: **GitHub Actions**
- Repository: `goodnight-dev/react-hooks`
- Workflow: `release.yml`

From then on, the `Release` workflow publishes over OIDC — no token needed.

## Notes

- The "Version Packages" PR is created by the workflow's `GITHUB_TOKEN`, so it
  does not itself re-trigger CI (a GitHub safeguard against recursive runs). Its
  contents are mechanical (version + changelog bump) — review and merge.
- Want to see what a release _would_ include without cutting it? Run
  `pnpm changeset status`.
