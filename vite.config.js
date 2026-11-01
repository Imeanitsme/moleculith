import { defineConfig } from 'vite';
import { resolve } from 'path';

// Relative base so the built site works from any GitHub Pages subpath.
export default defineConfig({
  base: './',
  server: { port: 5199 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
      },
    },
  },
});
