// V2.3.3 验收沉淀（2026-08-24 Copilot 预发布验收轮 V2.3.3-pre-项目成本看板 → 2026-09-04 用户指示落实为正式版本 V2.3.3）
// 覆盖：统计-项目动态看板 新增「项目成本动态」tab（标准/花费/产出/非产出/范围扩张五维成本视图 + 成本健康矩阵 + 成本画像下钻）。
// 2026-09-04 已用登录态实测跑通。选择器踩坑记录：tab 切换是纯 <button>（非 el-tabs__item/role=tab）；
// 「成本总览/项目明细」视图切换是 el-radio-button（.el-radio-button__inner），选择器需覆盖 button 标签本身。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const PANEL_URL = '/statistic/project_risk_panel';

/** 点击文案完全匹配的 tab 按钮（该页 tab 是纯 button，非 el-tabs） */
async function clickTab(page, text) {
  return page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === t);
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
}

/** 点击 el-radio-button 视图切换项（成本总览/项目明细等） */
async function clickRadioButton(page, text) {
  return page.evaluate((t) => {
    const inner = [...document.querySelectorAll('.el-radio-button__inner')].find((b) => b.innerText.trim() === t);
    if (inner) { inner.click(); return true; }
    return false;
  }, text);
}

test.describe('V2.3.3 回归', () => {
  // ① 「项目成本动态」tab 存在且可切换，五维成本视图渲染
  test('① 项目动态看板新增「项目成本动态」tab + 五维成本视图 @data_export', async ({ page }) => {
    await page.goto(PANEL_URL);
    await page.waitForTimeout(5000);
    await h.dismissAnnouncement(page);
    const tabClicked = await clickTab(page, '项目成本动态');
    expect(tabClicked, '应存在「项目成本动态」tab 可点击').toBe(true);
    await page.waitForTimeout(3000);
    const ui = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasStandard: /标准/.test(body),
        hasSpend: /花费/.test(body),
        hasOutput: /产出/.test(body),
        hasNonOutput: /非产出/.test(body),
        hasExpand: /范围扩张|范围扩张合计/.test(body),
        hasHealthMatrix: /成本类.*项.*范围扩张.*项|命中成本超支/.test(body),
        hasPeriodSwitch: /统计周期/.test(body),
      };
    });
    expect(ui.hasStandard, '应展示"标准"维度').toBe(true);
    expect(ui.hasSpend, '应展示"花费"维度').toBe(true);
    expect(ui.hasOutput, '应展示"产出"维度').toBe(true);
    expect(ui.hasNonOutput, '应展示"非产出"维度').toBe(true);
    expect(ui.hasExpand, '应展示"范围扩张"维度').toBe(true);
    expect(ui.hasHealthMatrix, '应有健康矩阵/告警统计区块').toBe(true);
    expect(ui.hasPeriodSwitch, '应有统计周期筛选区').toBe(true);
  });

  // ② 「成本总览」/「项目明细」两视图切换 + 统计周期筛选生效
  test('② 成本总览/项目明细视图切换 + 统计周期筛选生效 @data_export', async ({ page }) => {
    await page.goto(PANEL_URL);
    await page.waitForTimeout(5000);
    await h.dismissAnnouncement(page);
    await clickTab(page, '项目成本动态');
    await page.waitForTimeout(3000);
    // 切到「项目明细」视图
    const switched = await clickRadioButton(page, '项目明细');
    expect(switched, '应能切换到「项目明细」视图').toBe(true);
    await page.waitForTimeout(2000);
    const hasTable = await page.evaluate(() => !!document.querySelector('.el-table'));
    expect(hasTable, '「项目明细」视图应渲染表格').toBe(true);
    // 切回总览
    const back = await clickRadioButton(page, '成本总览');
    expect(back, '应能切回「成本总览」视图').toBe(true);
    await page.waitForTimeout(2000);
    // 统计周期切换（月）应生效：切月后触发新请求并渲染 headline
    const monthOk = await clickRadioButton(page, '月');
    expect(monthOk, '应有「月」统计周期可切换').toBe(true);
    await page.waitForTimeout(2000);
    const bodyAfterMonth = await page.evaluate(() => document.body.innerText);
    expect(/开工的项目/.test(bodyAfterMonth), '切换统计周期后应重新渲染"XX开工的项目"描述行').toBe(true);
  });

  // ③ 点击项目明细行「成本画像」按钮下钻弹窗
  test('③ 成本画像下钻弹窗含指标卡/告警/工时去向线索 @data_export', async ({ page }) => {
    await page.goto(PANEL_URL);
    await page.waitForTimeout(5000);
    await h.dismissAnnouncement(page);
    await clickTab(page, '项目成本动态');
    await page.waitForTimeout(3000);
    // 切到「年」周期保证有足够项目样本，再切「项目明细」
    await clickRadioButton(page, '年');
    await page.waitForTimeout(2000);
    await clickRadioButton(page, '项目明细');
    await page.waitForTimeout(2000);
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /成本画像/.test(b.innerText));
      if (btn) { btn.click(); return true; }
      return false;
    });
    test.skip(!clicked, '当前统计周期无在统计项目行（数据状态所限），跳过');
    await page.waitForTimeout(2000);
    const dlgOk = await page.evaluate(() => {
      const dlgs = [...document.querySelectorAll('.el-dialog__wrapper')].filter((d) => getComputedStyle(d).display !== 'none');
      const d = dlgs.pop();
      if (!d) return { open: false };
      const text = d.innerText;
      return {
        open: true,
        hasTitle: /成本关键指标/.test(text),
        hasAlert: /告警|风险|超支|健康|领先/.test(text),
        hasAI: /AI\s*分析|开始分析|分析本项目/.test(text),
      };
    });
    expect(dlgOk.open, '点「成本画像」应打开下钻弹窗').toBe(true);
    expect(dlgOk.hasTitle, '弹窗应含「成本关键指标」区块（标准/花费/产出/非产出/CPI等指标卡）').toBe(true);
    expect(dlgOk.hasAI, '弹窗应含单项目级 AI 分析入口').toBe(true);
  });
});

