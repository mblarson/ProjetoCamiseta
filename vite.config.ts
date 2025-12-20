import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Isolate framer-motion into its own chunk because it's a large dependency.
          if (id.includes('framer-motion')) {
            return 'framer-motion';
          }
          // Group all other dependencies from node_modules into a single vendor chunk.
          // This improves browser caching, as vendor code changes less frequently than app code.
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})