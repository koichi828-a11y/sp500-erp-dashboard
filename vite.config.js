import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sp500-erp-dashboard/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
