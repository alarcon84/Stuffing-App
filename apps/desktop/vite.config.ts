import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@stuffing-calc/core', '@stuffing-calc/ui'], // Prevent pre-bundling workspace packages
  },
  server: {
    port: 3000,
    strictPort: true, // Fail if 3000 is in use, so we know to kill the zombie process
  },
})
