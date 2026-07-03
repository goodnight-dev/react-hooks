# 1. Versioning and commit conventions

- **Status:** Accepted
- **Date:** 2026-07-03

## Context

`@goodnight-dev/react-hooks` is a single published package. We still need:

1. a **changelog and version-bump mechanism** that scales cleanly as the hook
   surface grows, and
2. a **commit-message convention** for a clean, legible history.

A natural temptation is to let Conventional Commits _drive_ the version
automatically (e.g. release-please, semantic-release). The question is whether
that's worth adopting for a single package versus a simpler, explicit
alternative.

## Decision

1. **Changesets is the single source of truth for versioning**, even for one
   package. Every change that affects the published package includes a changeset
   declaring the bump level and a human-written summary, which also becomes the
   `CHANGELOG.md` entry. This is the same tool and workflow used by
   [`@goodnight-dev/utils`](https://github.com/goodnight-dev/utils), so the
   release mechanics are consistent across the `@goodnight-dev` packages.

2. **Conventional Commits are enforced for history hygiene only — not for
   versioning.** `commitlint` (with `@commitlint/config-conventional`) runs on
   the `commit-msg` git hook via `lefthook`. The commit _type_ (`feat`, `fix`,
   …) documents intent in the log; it does **not** compute the version number.

## Alternatives considered

- **release-please / semantic-release (commit-driven).** Would infer the bump
  from Conventional Commit types, removing the second changeset-authoring step.
  Rejected: the bump-and-changelog text becomes whatever the commit message
  says, which is optimized for history, not for a user-facing changelog entry.
  Changesets asks for both, explicitly, at the point a contributor knows the
  most about user-facing impact.
- **Manual version edits.** Error-prone and no changelog automation. Rejected.

## Consequences

- Explicit, reviewable version bumps and changelog entries, authored at PR time
  rather than inferred from commit prose.
- Conventional Commits still give a clean history and keep the door open to
  commit-based tooling later, without being load-bearing for releases.
- Intent is expressed in two places (the commit _and_ the changeset). This
  redundancy is the accepted cost of an explicit, human-authored changelog.
- CI runs the Changesets GitHub Action to open the "Version Packages" PR and
  publish on merge (with npm provenance) — see
  [ADR 0002](./0002-oidc-trusted-publishing.md).
