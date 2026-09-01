import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // As funções testadas são puras (agregação de ativos) — não tocam DOM.
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
