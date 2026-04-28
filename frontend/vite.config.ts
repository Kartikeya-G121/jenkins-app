import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_ROUTES = ['/builds', '/webhook', '/queue', '/workers', '/repositories'];

const apiProxy = {
  target: 'http://localhost:4000',
  changeOrigin: true,
  bypass: (req: any) => {
    // If the browser is navigating (accepts HTML), let Vite serve the SPA
    if (req.headers.accept?.includes('text/html')) return req.url;
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(API_ROUTES.map((r) => [r, apiProxy])),
  },
})
