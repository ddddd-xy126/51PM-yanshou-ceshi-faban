// V2.3.1 验收沉淀（2026-08-03 Copilot 验收轮）
// 覆盖：递交程序开发筛选 / 模型外包外包筛选 / 项目概览时间轴预估营收 / 测试数据看板超时原因。
// （项目动态→我的动态重构见 v2.3.0.spec ⑦，按 P-07 就地改旧 spec，不在此重复）
// 策略：静态 UI 要素硬断言 + 关键交互监听接口参数；数据依赖走既有真实数据的动态发现。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const OUTSOURCE_PROJECT_ID = 6342; // 亿滋工厂及仓储孪生项目二期（外包发包 27 条 + plan_income_date=2026-09）

test.describe('V2.3.1 回归', () => {
  // 用户体验 递交列表新增「程序开发」人员筛选（供程序侧拉数据）
  test('① 递交列表：新增「程序开发」人员筛选 + chengxu_people 参数 @project_publish', async ({ page }) => {
    await page.goto('/OPStestList/OPStestList_list');
    await page.waitForTimeout(4000);
    await h.dismissAnnouncement(page);
    // 静态：筛选区有「程序开发」下拉、表头有「程序开发」列
    const ui = await page.evaluate(() => ({
      hasFilter: [...document.querySelectorAll('.el-input__inner')].some((i) => i.placeholder === '程序开发'),
      hasCol: [...document.querySelectorAll('.el-table__header th')].some((t) => t.innerText.includes('程序开发')),
    }));
    expect(ui.hasFilter, '筛选区应有「程序开发」下拉').toBe(true);
    expect(ui.hasCol, '表格应有「程序开发」列').toBe(true);
    // 交互：选一个程序开发人员 → 请求带 chengxu_people 参数
    const reqs = [];
    page.on('request', (q) => { if (/project_publish\/get_list/.test(q.url())) reqs.push(q.url()); });
    await page.locator('input[placeholder="程序开发"]').first().click();
    await page.waitForTimeout(1200);
    const opt = page.locator('.el-select-dropdown__item:visible').first();
    test.skip(!(await opt.count()), '程序开发下拉无可选人员（数据缺失）');
    await opt.click();
    await page.waitForTimeout(2500);
    expect(reqs.some((u) => /chengxu_people=\d+/.test(u)), '选程序开发人员应携 chengxu_people 参数请求').toBe(true);
  });

  // 新增功能 模型外包新增「外包」筛选（与自制对称）
  test('② 模型外包：新增「外包」筛选 + is_self_made 对称参数 @outsource', async ({ page }) => {
    await page.goto(`/project/outsource_project?projectId=${OUTSOURCE_PROJECT_ID}`);
    await page.waitForTimeout(4500);
    await h.dismissAnnouncement(page);
    // 静态：筛选 radio 含 全部/外包/内部自制
    const radios = await page.evaluate(() =>
      [...document.querySelectorAll('.el-radio-button__inner, .el-radio__label')].map((e) => e.innerText.trim())
    );
    expect(radios.includes('外包') && radios.includes('内部自制'), '筛选应含「外包」「内部自制」对称档').toBe(true);
    // 交互：点「外包」→ 请求 is_self_made=0
    const reqs = [];
    page.on('request', (q) => { if (/get_package_list/.test(q.url())) reqs.push(q.url()); });
    await page.locator('.el-radio-button__inner:has-text("外包")').filter({ hasText: /^外包$/ }).first().click();
    await page.waitForTimeout(2500);
    expect(reqs.some((u) => /is_self_made=0/.test(u)), '外包档应携 is_self_made=0 请求').toBe(true);
  });

  // 新增功能 项目概览时间轴新增「预估营收」节点（月精度）
  test('③ 项目概览：时间轴含「预估营收」节点 @project_detail', async ({ page }) => {
    await page.goto(`/project/project_detail?projectId=${OUTSOURCE_PROJECT_ID}`);
    await page.waitForTimeout(5000);
    await h.dismissAnnouncement(page);
    const t = await page.evaluate(() => document.body.innerText);
    // 时间轴节点标签常驻（无值显 —，有值显 YYYY-MM）
    expect(t.includes('预估营收'), '项目概览时间轴应有「预估营收」节点').toBe(true);
    // 时间轴营收与「基本信息」预估营收时间字段同源（月精度）
    expect(/预估营收时间/.test(t), '基本信息应含「预估营收时间」字段').toBe(true);
  });

  // 体验升级 测试数据看板：递交明细行「查看超时原因」按钮 → 弹窗呈现该项目超时原因
  test('④ 测试数据看板：递交超时明细「查看超时原因」呈现原因 @data_export', async ({ page }) => {
    await page.goto('/statistic/bug');
    await page.waitForTimeout(5000);
    await h.dismissAnnouncement(page);
    // 切季度取含超时数据的周期
    await page.locator('.el-radio-button__inner:has-text("季度")').first().click().catch(() => {});
    await page.waitForTimeout(3500);
    // 点「超时递交」卡片打开递交明细
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('*')].filter((e) => /^超时递交\d+项/.test((e.innerText || '').replace(/\s/g, '')) && e.children.length <= 5);
      cards[cards.length - 1]?.click();
    });
    await page.waitForTimeout(2800);
    const btnCount = await page.locator('button:has-text("查看超时原因")').count();
    test.skip(btnCount === 0, '当前周期无超时递交记录（数据缺失）');
    // 点第一个「查看超时原因」→ 弹「超时原因」弹窗含原因文本
    await page.locator('button:has-text("查看超时原因")').first().click();
    await page.waitForTimeout(1800);
    const dlg = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent && /超时原因/.test(x.innerText));
      return d ? d.innerText.replace(/\s+/g, '') : null;
    });
    expect(dlg, '应弹出「超时原因」弹窗').toBeTruthy();
    expect(dlg.length > 10, '超时原因弹窗应呈现项目与原因内容').toBe(true);
  });
});
