/**
 * Conventional Commits, enforced on the `commit-msg` git hook (see lefthook.yml).
 *
 * Commit messages are for history hygiene only — they do NOT drive version
 * numbers. Version bumps are declared explicitly with Changesets. See
 * docs/adr/0001-versioning-and-commit-conventions.md.
 */
export default {
  extends: ['@commitlint/config-conventional'],
};
