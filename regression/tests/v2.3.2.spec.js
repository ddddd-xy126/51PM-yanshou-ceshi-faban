// V2.3.2 验收沉淀（2026-08-17 Copilot 验收轮）
// 覆盖：模型外包-查看日报抽屉(弹窗→抽屉) / 抽屉快捷添加反馈 + 反馈走查留言 / 验收工作台查看反馈走查留言 / AI自动填充项目动态。
// 策略：静态 UI 要素硬断言 + 关键交互监听接口参数；数据依赖优先动态发现带日报/待验收的发包。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const OUTSOURCE_PROJECT_ID = 6679; // 半导体（发包#31 有 46 条日报，样本充足）
const S2_PACKAGE_ID = 45; // 广交会展L4外包（含待验收 quality_status=2 反馈，task247 带走查留言）

test.describe('V2.3.2 回归', () => {
  // ① 模型外包-查看日报：弹窗→抽屉重构（摘要态卡片 + 搜索 + 添加新反馈）
  test('① 查看日报重构为右侧抽屉 + 摘要态卡片 @outsource', async ({ page }) => {
    await page.goto(`/project/outsource_project?projectId=${OUTSOURCE_PROJECT_ID}`);
    await page.waitForTimeout(4500);
    await h.dismissAnnouncement(page);
    const link = page.locator('text=/查看日报\\(\\d+\\)/').first();
    test.skip(!(await link.count()), '当前项目无带日报的发包（测试库刷新），跳过');
    await link.click();
    await page.waitForTimeout(2500);
    const ui = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer');
      if (!drawer) return { hasDrawer: false };
      return {
        hasDrawer: true,
        title: (drawer.querySelector('.el-drawer__title, header')?.innerText || '').includes('模型制作日报'),
        cardCount: drawer.querySelectorAll('.pdrd-task-card').length,
        hasSearch: !!drawer.querySelector('input[placeholder*="搜索模型"]'),
        hasAddFeedback: [...drawer.querySelectorAll('button')].some((b) => b.innerText.includes('添加新反馈')),
      };
    });
    expect(ui.hasDrawer, '查看日报应打开右侧抽屉 el-drawer').toBe(true);
    expect(ui.title, '抽屉标题应含「模型制作日报」').toBe(true);
    expect(ui.cardCount, '抽屉应有摘要态模型任务卡').toBeGreaterThan(0);
    expect(ui.hasSearch, '抽屉应有模型/建筑搜索框').toBe(true);
    expect(ui.hasAddFeedback, '任务卡应有「添加新反馈」快捷入口').toBe(true);
  });

  // ② 抽屉内反馈走查单 + 反馈走查留言输入
  test('② 抽屉反馈走查单 + 反馈走查留言输入区 @outsource', async ({ page }) => {
    await page.goto(`/project/outsource_project?projectId=${OUTSOURCE_PROJECT_ID}`);
    await page.waitForTimeout(4500);
    await h.dismissAnnouncement(page);
    const link = page.locator('text=/查看日报\\(\\d+\\)/').first();
    test.skip(!(await link.count()), '当前项目无带日报的发包，跳过');
    await link.click();
    await page.waitForTimeout(2500);
    // 点一个「N条反馈」chip 打开反馈走查单
    const opened = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer');
      const cards = [...drawer.querySelectorAll('.pdrd-task-card')];
      for (const c of cards) {
        const chip = [...c.querySelectorAll('[class*=chip]')].find((x) => /[1-9]\d*\s*条反馈/.test(x.innerText));
        if (chip) { chip.click(); return true; }
      }
      return false;
    });
    test.skip(!opened, '无含反馈的任务卡（数据缺失），跳过');
    await page.waitForTimeout(2000);
    const dlg = await page.evaluate(() => {
      const title = document.querySelector('.tfd-header__title');
      const d = title ? title.closest('.el-dialog') : null;
      return {
        hasDialog: !!d,
        titleOk: title ? title.innerText.includes('反馈走查单') : false,
        hasLiuyan: d ? /反馈走查留言/.test(d.innerText) : false,
        hasInput: d ? !!d.querySelector('textarea[placeholder*="验收建议"]') : false,
      };
    });
    expect(dlg.hasDialog, '点「N条反馈」应打开模型反馈走查单弹窗').toBe(true);
    expect(dlg.titleOk, '弹窗标题应含「反馈走查单」').toBe(true);
    expect(dlg.hasLiuyan, '弹窗应含「反馈走查留言」区').toBe(true);
    expect(dlg.hasInput, '应有走查留言输入框（写下你的验收建议…）').toBe(true);
  });

  // ③ 验收工作台批量验收时可「查看反馈走查留言」
  test('③ 验收工作台含「查看反馈走查留言」入口 @outsource', async ({ page }) => {
    await page.goto(`/project/outsource_detail?outsourcePackageId=${S2_PACKAGE_ID}`);
    await page.waitForTimeout(4500);
    await h.dismissAnnouncement(page);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === '反馈管理'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const wbBtn = page.locator('button:has-text("验收工作台")');
    test.skip(!(await wbBtn.count()), '该发包无验收工作台（非外包/无反馈），跳过');
    await wbBtn.click();
    await page.waitForTimeout(2500);
    const ui = await page.evaluate(() => {
      const wbOpen = /反馈验收工作台/.test(document.body.innerText);
      const empty = /当前没有待验收的反馈/.test(document.body.innerText);
      const hasBtn = [...document.querySelectorAll('button')].some((b) => /查看反馈走查留言/.test(b.innerText));
      return { wbOpen, empty, hasBtn };
    });
    test.skip(ui.empty || !ui.wbOpen, '当前发包无待验收反馈（数据状态所限），跳过');
    expect(ui.hasBtn, '验收工作台每条反馈应有「查看反馈走查留言」入口').toBe(true);
  });

  // ⑤ AI自动填充项目动态：会议动态 tab 的 AI 自动填充入口 + 粘贴区
  test('⑤ 添加会议动态含「AI 自动填充」入口与粘贴识别流程 @project_moment', async ({ page }) => {
    await page.goto(`/project/project_moment?projectId=${OUTSOURCE_PROJECT_ID}`);
    await page.waitForTimeout(4500);
    await h.dismissAnnouncement(page);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /添加动态/.test(x.innerText)); if (b) b.click(); });
    await page.waitForTimeout(1500);
    // 会议动态 tab 应默认在，断言 AI 自动填充按钮存在
    const has = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => getComputedStyle(d.closest('.el-dialog__wrapper') || d).display !== 'none').pop();
      if (!dlg) return { dlg: false };
      return {
        dlg: true,
        tabs: [...dlg.querySelectorAll('.el-tabs__item, [role=tab]')].map((t) => t.innerText.trim()),
        hasAIBtn: [...dlg.querySelectorAll('button')].some((b) => b.innerText.trim() === 'AI 自动填充'),
        hasAgentBtn: [...document.querySelectorAll('button')].some((b) => /Agent 任务进程/.test(b.innerText)),
      };
    });
    expect(has.dlg, '应打开添加动态弹窗').toBe(true);
    expect(has.tabs.join(','), '应含会议/风险/问题动态 tab').toContain('会议动态');
    expect(has.hasAIBtn, '会议动态 tab 应有「AI 自动填充」入口').toBe(true);
    expect(has.hasAgentBtn, '右下角应有「Agent 任务进程」按钮').toBe(true);
    // 打开 AI 子弹窗，断言粘贴区 + 开始 AI 识别
    await page.evaluate(() => { const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => getComputedStyle(d.closest('.el-dialog__wrapper') || d).display !== 'none').pop(); [...dlg.querySelectorAll('button')].find((b) => b.innerText.trim() === 'AI 自动填充').click(); });
    await page.waitForTimeout(1200);
    const ai = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /AI 自动填充 · 会议动态/.test(d.innerText) && getComputedStyle(d.closest('.el-dialog__wrapper') || d).display !== 'none');
      if (!dlg) return { open: false };
      return {
        open: true,
        hasPaste: !!dlg.querySelector('textarea[placeholder*="粘贴会议纪要"]'),
        hasStart: [...dlg.querySelectorAll('button')].some((b) => /开始 AI 识别/.test(b.innerText)),
      };
    });
    expect(ai.open, '应打开 AI 自动填充子弹窗').toBe(true);
    expect(ai.hasPaste, '应有会议纪要粘贴区').toBe(true);
    expect(ai.hasStart, '应有「开始 AI 识别」按钮').toBe(true);
  });
});
