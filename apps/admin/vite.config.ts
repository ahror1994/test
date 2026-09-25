import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3103',
      '/uploads': 'http://localhost:3103',
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
