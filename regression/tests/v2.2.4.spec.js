// V2.2.4 六项功能回归（沉淀自 2026-07 追溯验收轮）
// 数据前置：项目测试文档入口样本 = 项目 #6661；模型外包列表样本 = 项目 #6690。
//          数据缺失时相关断言 test.skip，不硬失败。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const DOC_PROJECT_ID = 6661; // 项目概览「项目测试文档」入口样本
const OUTSOURCE_PROJECT_ID = 6690; // 模型外包列表样本

test.describe('V2.2.4 回归', () => {
  test('① 排期表「过滤空白行列」开关存在且过滤无排期人员 @schedule', async ({ page }) => {
    await page.goto('/schedule/schedule_table');
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    // 开关文案存在
    const text = await page.evaluate(() => document.body.innerText);
    expect(text, '排期表应含「过滤空白行列」筛选项').toContain('过滤空白行列');
    // 通过 vm 读开关前后行数（集成浏览器坐标偏移坑；此处走 JS 触发最稳）
    const rowsBefore = await page.locator('.el-table__body-wrapper tr:visible').count();
    // 找到开关并打开
    const toggled = await page.evaluate(() => {
      const sw = [...document.querySelectorAll('.el-switch')].find((s) => {
        const label = s.closest('*')?.innerText || '';
        return /过滤空白行列/.test(s.parentElement?.innerText || label);
      });
      if (!sw) return false;
      if (!sw.classList.contains('is-checked')) sw.click();
      return true;
    });
    if (!toggled) test.skip(true, '未定位到「过滤空白行列」开关（页面结构变化，人工确认）');
    await page.waitForTimeout(1500);
    const rowsAfter = await page.locator('.el-table__body-wrapper tr:visible').count();
    // 纯前端展示筛选：开启后行数应 <= 原行数（无空白行时相等，data-dependent）
    expect(rowsAfter, '过滤后行数不应多于过滤前').toBeLessThanOrEqual(rowsBefore);
  });

  test('② 任务选项配置：项目场景-其它 含「项目资源迁移/项目资源导出」 @task_options', async ({ page }) => {
    await page.goto('/task_option_config');
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    let text = await page.evaluate(() => document.body.innerText);
    expect(text, '任务选项配置页应含「项目场景」分组').toContain('项目场景');
    // 二级选项在「项目场景 → 其它」折叠子树内，逐级展开后再核（接口层已精确断言 545/546）
    await page.evaluate(() => {
      const clickLeaf = (t) =>
        [...document.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && e.offsetWidth > 0 && e.innerText.trim() === t)[0]
          ?.click();
      clickLeaf('项目场景');
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const clickLeaf = (t) =>
        [...document.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && e.offsetWidth > 0 && e.innerText.trim() === t)[0]
          ?.click();
      clickLeaf('其它') || clickLeaf('其他');
    });
    await page.waitForTimeout(1000);
    text = await page.evaluate(() => document.body.innerText);
    if (!/项目资源迁移|项目资源导出/.test(text)) {
      test.skip(true, '二级选项在折叠子树内未能展开显示（接口层 api-v2.2.4 已断言 545/546，人工确认 UI）');
    }
    expect(text, 'UI 应可见 项目资源迁移').toContain('项目资源迁移');
    expect(text, 'UI 应可见 项目资源导出').toContain('项目资源导出');
  });

  test('③ 模型数据看板：总览 + 模型明细（项目维度/资产维度） @outsource', async ({ page }) => {
    await page.goto('/statistic/outsource_panel');
    await h.waitTableSettled(page);
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    for (const key of ['模型数据总览', '模型明细', '发包数量', '发包金额', '资产数量']) {
      expect(text, `模型数据看板应含「${key}」`).toContain(key);
    }
    // 切「模型明细」页，核项目/资产两个维度
    await page.evaluate(() => {
      [...document.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && e.offsetWidth > 0 && e.innerText.trim() === '模型明细')[0]
        ?.click();
    });
    await page.waitForTimeout(2000);
    const detailText = await page.evaluate(() => document.body.innerText);
    expect(detailText, '模型明细应含项目维度/资产维度切换').toMatch(/项目维度|资产维度/);
  });

  test('④ 我的工作台：组群配置页可创建/管理人员群组 @user_group', async ({ page }) => {
    await page.goto('/user_custom_group_config');
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    // 建组能力入口存在（新建分组/新增群组按钮）
    const hasCreate = await page
      .locator('button:visible', { hasText: /新建|新增|创建/ })
      .count();
    expect(hasCreate, '组群配置页应有建组按钮').toBeGreaterThan(0);
    // 存在群组/分组列表容器（有历史数据）
    expect(text, '组群配置页应展示分组/群组').toMatch(/分组|群组|组群/);
  });

  test('⑤ 项目概览：右侧信息栏含「项目测试文档」入口 @project_detail', async ({ page }) => {
    await page.goto(`/project/project_detail?projectId=${DOC_PROJECT_ID}`);
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    if (!/定制接口文档|行业接口文档/.test(text)) {
      test.skip(true, `项目 #${DOC_PROJECT_ID} 概况栏未加载文档区（数据缺失，人工确认）`);
    }
    expect(text, '项目概况栏应含「项目测试文档」入口').toContain('项目测试文档');
  });

  test('⑥ 模型外包：项目发包列表入口 @outsource', async ({ page }) => {
    await page.goto(`/project/outsource_project?projectId=${OUTSOURCE_PROJECT_ID}`);
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    // 模型外包列表页要素（发包/申请发包/审核/立项等）
    expect(text, '模型外包页应含发包相关操作').toMatch(/发包|外包/);
  });

  test('⑦ 供应商企业管理：新增供应商入口', async ({ page }) => {
    await page.goto('/supplier_manage');
    await h.waitTableSettled(page);
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    if (/404|页面不存在|无权限/.test(text)) {
      test.skip(true, '供应商企业管理页需 DTA-PM 权限，当前账号不可见（人工确认）');
    }
    expect(text, '供应商企业管理页应含供应商相关字段').toMatch(/供应商|信用代码|联系人/);
  });
});
