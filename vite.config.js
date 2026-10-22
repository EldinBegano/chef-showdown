import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the same build works at / or under a path prefix.
  base: './',
  server: {
    port: 5199,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:5200', ws: true } },
  },
  build: { chunkSizeWarningLimit: 800 },
});
