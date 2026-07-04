import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/use-local-storage.ts',
    'src/use-theme.ts',
    'src/use-window-size.ts',
  ],
  format: 'esm',
  dts: true,
  clean: true,
});
