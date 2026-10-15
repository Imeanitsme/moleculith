import { defineConfig } from 'vite';

// Relative base so the built site works from any GitHub Pages subpath.
export default defineConfig({
  base: './',
  server: { port: 5199 },
});
