# 2. OIDC trusted publishing via a custom publish step

- **Status:** Accepted
- **Date:** 2026-07-03

## Context

The package publishes to npm from CI (the `Release` workflow). We want **npm
OIDC trusted publishing** — no long-lived npm token stored as a secret, with
provenance attestations — which is npm's recommended approach for CI/CD.

The standard Changesets flow uses `changesets/action` with a `publish:` command
of `changeset publish`. That works with a stored `NPM_TOKEN`, but
**`changeset publish` does not drive npm's OIDC trusted-publishing handshake.**
Observed on the sibling `@goodnight-dev/utils` repo, on the same toolchain used
here: with npm well past the 11.5.1 release that added OIDC trusted publishing,
`id-token: write`, a configured trusted publisher, and no token,
`changeset publish` still fails with `ENEEDAUTH`. `changesets/action` even logs
"No NPM_TOKEN found, but OIDC is available - using npm trusted publishing," yet
the underlying publish never completes the OIDC exchange.

## Decision

Keep `changesets/action` for **versioning only** (the "Version Packages" PR),
and do the **publish** in
[`scripts/release-publish.mjs`](../../scripts/release-publish.mjs):

1. `pnpm pack` the package into a tarball.
2. `npm publish <tarball> --provenance` — plain `npm publish` **does** perform
   the OIDC trusted-publishing handshake and attach provenance.
3. Tag the published version (`name@version`) and open a matching GitHub
   Release, notes taken from `CHANGELOG.md`.

The workflow's `publish:` command points at this script (via the `release` npm
script).

## Alternatives considered

- **`changeset publish` + OIDC.** The intended path, but it does not work today
  (see Context). Revisit if/when Changesets adds OIDC support — at which point
  this script can be deleted in favor of `changeset publish`.
- **`NPM_TOKEN` secret + `changeset publish`.** Reliable and standard, but
  stores a long-lived token (which npm explicitly discourages for CI), and a
  granular token expires and becomes future breakage. Rejected in favor of
  storing no secret.

## Consequences

- No npm token stored anywhere; CI authenticates per-publish via OIDC, with
  provenance — npm's recommended posture.
- We maintain a small publish script instead of one `changeset publish` call,
  reproducing its "publish + tag" behavior (it does not create GitHub Releases;
  git tags are created, and the release script adds the GitHub Release on top).
- A brand-new package needs a one-time manual bootstrap publish before a Trusted
  Publisher can be configured for it (npm requires the package to exist first) —
  documented in [`cutting-a-release.md`](../recipes/cutting-a-release.md).
- When Changesets supports OIDC, delete the script and revert `release` to
  `changeset publish`.
