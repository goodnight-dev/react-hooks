// Publishes the package if its current version is not yet on npm.
//
// Why this exists instead of `changeset publish`:
//   As of mid-2026, `changeset publish` does not drive npm's OIDC trusted-
//   publishing handshake — it returns ENEEDAUTH even on npm >= 11.5.1 with a
//   trusted publisher configured. To publish over OIDC (no stored token) we do
//   it ourselves: `pnpm pack` builds the tarball, and `npm publish <tarball>`
//   performs the OIDC auth + provenance attestation.
//
// A published version gets a `name@version` git tag and a matching GitHub
// Release whose notes come from CHANGELOG.md.
//
// See docs/adr/0002-oidc-trusted-publishing.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', ...options });

const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));

// Pull the changelog section for a version (everything under `## <version>` up
// to the next `## ` heading), to use as GitHub Release notes.
const changelogNotes = (version) => {
  const path = 'CHANGELOG.md';
  if (!existsSync(path)) return '';
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
};

const isPublished = (name, version) => {
  try {
    run('npm', ['view', `${name}@${version}`, 'version']);
    return true;
  } catch {
    return false;
  }
};

if (isPublished(name, version)) {
  console.log(`${name}@${version} already on npm — nothing to publish.`);
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'release-'));

  console.log(`packing ${name}@${version}`);
  const packOutput = run('pnpm', ['pack', '--pack-destination', tmp]);
  const tarball = packOutput
    .split('\n')
    .map((line) => line.trim())
    .findLast((line) => line.endsWith('.tgz'));
  if (!tarball) throw new Error('Could not locate packed tarball');

  console.log(`publishing ${name}@${version} via OIDC trusted publishing`);
  run('npm', ['publish', tarball, '--provenance', '--access', 'public'], {
    stdio: 'inherit',
  });

  const tag = `${name}@${version}`;
  run('git', ['tag', tag]);
  run('git', ['push', '--tags'], { stdio: 'inherit' });
  console.log(`published and tagged ${tag}`);

  // Mirror the published version as a GitHub Release. Non-fatal: the package
  // is already on npm, so a Release-page failure must not fail the run.
  try {
    run('gh', [
      'release',
      'create',
      tag,
      '--title',
      tag,
      '--notes',
      changelogNotes(version) || tag,
    ]);
    console.log(`created GitHub release ${tag}`);
  } catch (error) {
    console.warn(
      `WARN: could not create GitHub release ${tag}: ${error.stderr ?? error.message}`,
    );
  }
}
