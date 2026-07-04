import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import functional from 'eslint-plugin-functional';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/docs/api/**', '**/.tmp/**'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
    ],
    plugins: { perfectionist, functional },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Keep the barrel (`src/index.ts`) and any named exports alphabetised, so
      // a re-export lands in a deterministic place. Both are autofixable
      // (`eslint --fix`).
      'perfectionist/sort-exports': 'error',
      'perfectionist/sort-named-exports': 'error',
      // Every property of an exported `interface`/`type` must be `readonly`
      // (CONTRIBUTING.md §1) — a hook's return value and any props/options
      // object are shapes a consumer reads, never mutates in place. Flags the
      // declaration (not autofixable for `interface` — the plugin only
      // rewrites `type` aliases, whose whole body is one text expression it
      // can pattern-replace; an `interface`'s members are a structural list,
      // so the modifier has to be added by hand). Scoped to `ReadonlyShallow`
      // rather than the plugin's stricter default (recursive `Immutable`,
      // which would also demand e.g. `ReadonlyArray` for any array property)
      // — narrower, and matches what CONTRIBUTING.md asks for today; raising
      // it later is a one-line change.
      'functional/type-declaration-immutability': [
        'error',
        {
          rules: [
            {
              identifiers: '.+',
              immutability: 'ReadonlyShallow',
              comparator: 'AtLeast',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    // Ban lingering work-in-progress markers everywhere, so a half-wired hook
    // cannot merge — `pnpm check` stays red until each one is resolved.
    rules: {
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme'], location: 'anywhere' },
      ],
    },
  },
  prettier,
);
