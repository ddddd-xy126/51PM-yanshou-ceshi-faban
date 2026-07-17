// 51PM headless 截图/回归脚手架 —— 可复用登录模块（V2.2.8 轮验证）
// 用途：交付截图（定妆图/BUG现场）一律用 headless 脚本截，集成浏览器只做探索交互。
// 用法：
//   const { launchLoggedIn } = require('../scripts/headless-login');
//   const { browser, page, shot } = await launchLoggedIn();
//   await page.goto('http://10.67.8.183:7777/statistic/pm_panel'); ...
//   await shot(page, 'd:/.../final-xxx.jpg');
//   await browser.close();
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://10.67.8.183:7777';
const AUTHORIZE =
  'http://cas-test.51aes.com/oauth/authorize?client_id=vtWuKx7A&response_type=code&scope=all&redirect_uri=' + BASE;

function getSession() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const c = (state.cookies || []).find((x) => x.name === 'SESSION' && x.domain.includes('51aes'));
  if (!c) throw new Error('auth/state.json 无 SESSION cookie，先 npm run login');
  return c.value;
}

/**
 * 启动 headless 浏览器并完成 SSO 免扫码登录。
 * 登录姿势（坑已验证）：addCookies 种 CAS SESSION → oauth/authorize 免扫码回 app →
 * **停在落地页等待渲染**（切勿再 goto /main，会变成只有水印的空壳）。
 */
async function launchLoggedIn({ width = 1920, height = 1080 } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.addCookies([
    { name: 'SESSION', value: getSession(), domain: '.51aes.com', path: '/', secure: true },
  ]);
  const page = await ctx.newPage();
  await page.goto(AUTHORIZE);
  await page.waitForSelector('li.el-menu-item', { timeout: 30000 }).catch(async () => {
    const url = page.url();
    await browser.close();
    throw new Error(`SSO 续登失败（落在 ${url}）：SESSION 可能过期，需 npm run login 重新扫码`);
  });
  await dismissAnnouncement(page);
  return { browser, ctx, page, shot };
}

/** 关版本更新公告弹窗 */
async function dismissAnnouncement(page) {
  await page
    .evaluate(() => {
      [...document.querySelectorAll('.el-dialog__wrapper')]
        .filter((d) => d.offsetWidth > 0 && /版本更新|知道了/.test(d.innerText))
        .forEach((d) => {
          const btn = [...d.querySelectorAll('button, span, div')].find(
            (b) => b.innerText.trim() === '知道了' && b.children.length === 0
          );
          (btn || d.querySelector('.el-dialog__headerbtn'))?.click();
        });
    })
    .catch(() => {});
  await page.waitForTimeout(400);
}

/** 截图（内置视口断言，headless 下恒真，防止误在受限环境使用本模块） */
async function shot(page, filePath) {
  const w = await page.evaluate(() => window.innerWidth);
  if (w !== (page.viewportSize()?.width ?? 1920)) throw new Error(`innerWidth=${w} 与 viewport 不符，禁止出图`);
  await page.screenshot({ path: filePath, type: 'jpeg', quality: 80 });
  console.log('shot:', filePath);
}

module.exports = { launchLoggedIn, dismissAnnouncement, shot, BASE };
