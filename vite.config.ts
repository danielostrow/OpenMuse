import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src/renderer/lib'),
      '$stores': resolve(__dirname, 'src/renderer/lib/stores'),
      '$components': resolve(__dirname, 'src/renderer/lib/components')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
