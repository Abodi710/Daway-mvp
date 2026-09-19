import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Both the dev server and `vite preview` forward API traffic to the Express
// backend in server.cjs, so a production build can be smoke-tested locally
// without setting VITE_API_BASE.
const apiProxy = {
  '/api': 'http://localhost:5000',
  '/status': 'http://localhost:5000'
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: apiProxy
  },
  preview: {
    port: 4173,
    proxy: apiProxy
  }
})
