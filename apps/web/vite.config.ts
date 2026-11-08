import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const api = process.env.GLOBY_API ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    proxy: { '/api': api },
  },
  build: {
    sourcemap: true,
    // The app chunk carries the country and region index (~180 kB) used by pickers and stats.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          ui: ['radix-ui', 'sonner', 'lucide-react', 'cmdk', 'react-day-picker'],
          data: ['@tanstack/react-query'],
          charts: ['recharts'],
          map: ['d3-geo', 'd3-zoom', 'd3-selection', 'd3-transition', 'topojson-client'],
        },
      },
    },
  },
});
