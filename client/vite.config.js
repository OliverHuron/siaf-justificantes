import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En producción el cliente se sirve estático desde client/dist y nginx
// proxya /api al backend (:5004). En desarrollo, Vite hace ese proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5004',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
