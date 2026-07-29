// V2.2.2 五项功能回归（沉淀自 2026-07-29 Copilot 历史版本验收轮）
// V2.2.2 是「项目反馈递交流程」源头版本，整链由 v2.2.3~v2.3.0 的 @project_publish 簇覆盖；
// 本文件只补 V2.2.2 特有、后续 spec 未覆盖的新 UI 要素（均为静态 UI 硬断言，无数据依赖）。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// 打开某个筛选 el-select（按 placeholder 定位）并返回其下拉可见选项文本
async function openSelectOptions(page, placeholder) {
  const sel = page.locator(`.el-select:has(input[placeholder="${placeholder}"])`).first();
  await sel.click();
  await page.waitForTimeout(500);
  return page.evaluate(() =>
    [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')]
      .map((o) => o.innerText.trim())
      .filter(Boolean)
  );
}

test.describe('V2.2.2 回归', () => {
  test('① 拆解项目反馈-反馈模块枚举含「逃逸Bug」 @produce_demand', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await h.dismissAnnouncement(page);
    // 子页直接 URL 会被重定向回 main，必须点左侧菜单进入（entry_map 坑）
    await page.locator('.el-menu-item:has-text("我的信箱"), aside :text("我的信箱")').first().click();
    await page.waitForURL(/myMessageBox/, { timeout: 10000 });
    await page.waitForTimeout(1500);
    // 默认在「拆解项目反馈」tab；打开「反馈模块」筛选下拉
    const opts = await openSelectOptions(page, '反馈模块');
    expect(opts, '反馈模块枚举应包含 逃逸Bug').toContain('逃逸Bug');
    // 同时确认拆解链路入口在位（拆解 / 立即解决 按钮）
    const hasSplit = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) => /拆\s*解/.test(b.innerText))
    );
    expect(hasSplit, '拆解项目反馈页应有「拆解」操作').toBe(true);
  });

  test('② 项目编辑表单含「特殊事项需同步」+ 选是展开提醒 @project_detail', async ({ page, request }) => {
    // 取一个真实项目 id 直达编辑表单（fixed-right 编辑图标 click 会被固定列拦截，改直达）
    const r = await request.get(`${h.API_BASE}/manage_api/project/get_project_list?page=1&limit=5`, { headers: h.authHeaders() });
    const body = await r.json();
    const list = body?.data?.data || body?.data || [];
    test.skip(!list.length, '项目列表接口无数据（测试库刷新后重扫）');
    await page.goto(`/project/project_form/${list[0].id}`);
    await h.dismissAnnouncement(page);
    await page.waitForTimeout(1800);
    // 「特殊事项需同步」字段 + 是/否 radio 存在
    const specialItem = page.locator('.el-form-item:has(.el-form-item__label:text-is("特殊事项需同步"))').first();
    await expect(specialItem, '编辑表单应含「特殊事项需同步」字段').toBeVisible();
    const radios = specialItem.locator('.el-radio');
    expect(await radios.count(), '特殊事项需同步应为 是/否 单选').toBeGreaterThanOrEqual(2);
    // 切「否」再切「是」触发条件渲染 → 出现「特殊事项提醒」输入
    await radios.nth(1).click();
    await page.waitForTimeout(300);
    await radios.nth(0).click();
    await page.waitForTimeout(400);
    const remind = page.locator('textarea[placeholder="请输入特殊注意事项"]');
    await expect(remind, '选「是」后应展开「特殊事项提醒」输入框').toBeVisible();
  });

  test('③ 排期表「进入排期模式」支持拖动多选连续单元格 @schedule', async ({ page }) => {
    await page.goto('/schedule/schedule_table');
    await h.dismissAnnouncement(page);
    await page.waitForTimeout(2000);
    const enterBtn = page.locator('button:has-text("进入排期模式")').first();
    await expect(enterBtn, '排期表应有「进入排期模式」按钮').toBeVisible();
    await enterBtn.click();
    await page.waitForTimeout(1200);
    // 进入后提示文案 + 按钮切换为「退出排期模式」
    const hint = await page.evaluate(() => document.body.innerText.includes('拖动鼠标选择同一行的连续单元格'));
    expect(hint, '进入排期模式应提示可拖动选择同一行连续单元格').toBe(true);
    await expect(page.locator('button:has-text("退出排期模式")').first()).toBeVisible();
    // 复原
    await page.locator('button:has-text("退出排期模式")').first().click();
  });

  test('④ 任务列表新增「任务时间/花费日期」两种时间筛选方式 @project_task', async ({ page }) => {
    await page.goto('/task_panel/project_task');
    await h.dismissAnnouncement(page);
    await page.waitForTimeout(1800);
    // 日期范围旁的筛选方式下拉（placeholder 为「请选择」，选项含 任务时间/花费日期）
    let matched = null;
    const selects = page.locator('.el-select:has(input[placeholder="请选择"])');
    const n = await selects.count();
    for (let i = 0; i < n; i++) {
      await selects.nth(i).click();
      await page.waitForTimeout(400);
      const opts = await page.evaluate(() =>
        [...document.querySelectorAll('.el-select-dropdown:not([style*="display: none"]) .el-select-dropdown__item')].map((o) => o.innerText.trim())
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      if (opts.includes('任务时间') && opts.includes('花费日期')) { matched = opts; break; }
    }
    expect(matched, '任务模块应有「任务时间/花费日期」两种时间筛选方式').not.toBeNull();
  });

  test('⑤ 递交列表新增「递交排期时间轴」模块 @project_publish', async ({ page }) => {
    await page.goto('/OPStestList/OPStestList_list');
    await h.waitTableSettled(page);
    const timelineBtn = page.locator('button:has-text("递交排期时间轴"), :text("递交排期时间轴")').first();
    await expect(timelineBtn, '递交列表应有「递交排期时间轴」入口').toBeVisible();
    await timelineBtn.click();
    await page.waitForTimeout(1500);
    // 展开后出现时间轴刻度（含「现在」指示或时间轴节点）
    const hasTimeline = await page.evaluate(() =>
      document.querySelectorAll('[class*="timeline"]').length > 0 || /现在/.test(document.body.innerText)
    );
    expect(hasTimeline, '「递交排期时间轴」应渲染时间轴视图').toBe(true);
  });
});
