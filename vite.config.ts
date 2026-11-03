import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/arthik/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
