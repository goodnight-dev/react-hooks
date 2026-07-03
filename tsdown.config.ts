import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/use-theme.ts'],
  format: 'esm',
  dts: true,
  clean: true,
});
