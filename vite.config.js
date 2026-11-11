import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE || '/',
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { maxForks: 2, minForks: 1 } },
  },
})
