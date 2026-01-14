import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy API requests to Nginx (Docker)
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
