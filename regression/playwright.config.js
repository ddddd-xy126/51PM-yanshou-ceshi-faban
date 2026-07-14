// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1, // 同一账号串行执行，避免数据互相污染
  globalSetup: require.resolve('./scripts/global-setup.js'),
  globalTeardown: require.resolve('./scripts/global-teardown.js'),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    // 默认测试环境；需要在其他环境跑只读冒烟时：$env:BASE_URL='http://…'; npx playwright test
    baseURL: process.env.BASE_URL || 'http://10.67.8.183:7777',
    storageState: 'auth/state.json', // 由 npm run login 生成
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1600, height: 900 },
  },
  outputDir: 'test-results',
});
