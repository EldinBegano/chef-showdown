import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5199,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:5200', ws: true } },
  },
  build: { chunkSizeWarningLimit: 800 },
});
