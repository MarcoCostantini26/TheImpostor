import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run dev',
    cwd: __dirname,
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
