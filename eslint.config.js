import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
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
    plugins: { perfectionist },
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
