// 一次性登录：打开有头浏览器走企微 OAuth，登录成功后保存 storageState。
// 用法：npm run login （企微客户端上点确认即可，最长等 3 分钟）
const { chromium } = require('@playwright/test');
const path = require('path');
const { startProxy } = require('./start-proxy');

(async () => {
  await startProxy();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://10.67.8.183:7777/');

  console.log('等待企微登录（请在企业微信客户端确认，最长 3 分钟）...');
  await page.waitForURL(/10\.67\.8\.183.*my_board/, { timeout: 180_000 });
  await page.waitForTimeout(3000); // 等 token 落 cookie/localStorage

  const statePath = path.join(__dirname, '..', 'auth', 'state.json');
  await context.storageState({ path: statePath });
  console.log(`登录态已保存：${statePath}`);
  await browser.close();
  process.exit(0);
})();
