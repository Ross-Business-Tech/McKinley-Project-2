import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Two separate pages from the same code:
//   /           the staff app (property managers, supervisors, technicians)
//   /resident/  the resident app (no staff screens or staff sign-in inside it)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        staff: resolve(import.meta.dirname, 'index.html'),
        resident: resolve(import.meta.dirname, 'resident/index.html'),
      },
    },
  },
})
