import { describe, expect, it } from 'vitest';

import * as api from './index.js';

// Guards the package's public surface. Each hook's own test file exercises
// it directly, so a hook that is implemented and tested but never
// re-exported from this barrel would still pass it — and ship unreachable.
// This asserts the barrel itself, so a forgotten re-export fails `pnpm check`.
describe('package entry point', () => {
  it('exports exactly the documented public surface', () => {
    expect(Object.keys(api).sort()).toStrictEqual([
      'useLocalStorage',
      'useTheme',
    ]);
  });

  it('exports each member as a function', () => {
    for (const name of Object.keys(api)) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });
});
