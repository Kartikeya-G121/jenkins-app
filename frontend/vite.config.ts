import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/builds': { target: 'http://localhost:4000', changeOrigin: true },
      '/webhook': { target: 'http://localhost:4000', changeOrigin: true },
      '/queue':   { target: 'http://localhost:4000', changeOrigin: true },
      '/workers': { target: 'http://localhost:4000', changeOrigin: true },
    }
  }
})
