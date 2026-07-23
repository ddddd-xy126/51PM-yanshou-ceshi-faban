// V2.2.3 四项功能回归（沉淀自 2026-07-17 Copilot 验收轮）
// 数据依赖分层：静态 UI 要素硬断言；依赖落库数据的用「动态发现 → 找不到 test.skip」。
// 数据前置（供 skip 恢复参考）：反馈申请 #488（V2.2.3验收-批量表单组件测试反馈01，CBD物业管理系统 SJ202601230001，待PM审批）。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('V2.2.3 回归', () => {
  test('① 递交列表进详情返回后列表不折叠 @project_publish', async ({ page }) => {
    await page.goto('/OPStestList/OPStestList_list');
    await h.waitTableSettled(page);
    // 放宽日期（fill 不触发的坑 → vm form + search）并动态找可点击项目名
    const widen = () =>
      page.evaluate(async () => {
        const walk = (v, d) => { if (!v || d > 8) return null; if (v.form && (v.searchData || v.search)) return v; for (const c of v.$children || []) { const f = walk(c, d + 1); if (f) return f; } return null; };
        const vm = walk(document.querySelector('#app').__vue__, 0);
        vm.form.begin = '2026-06-01'; vm.form.end = '2026-12-31';
        (vm.searchData || vm.search).call(vm);
        await new Promise((r) => setTimeout(r, 2500));
        return vm.total;
      });
    const total = await widen();
    test.skip(!total, '测试库当前日期范围无递交数据（库刷新后放宽 begin/end 再试）');
    // 点项目名 → popconfirm 确定 → 详情页
    const cell = page.locator('.el-table__fixed .el-table__fixed-body-wrapper tbody tr').first().locator('td').nth(1).locator('.cell > *').first();
    await cell.click();
    await page.locator('button:visible', { hasText: '确定' }).last().click();
    await page.waitForURL(/project_detail/, { timeout: 10000 });
    // 浏览器后退返回递交列表
    await page.goBack();
    await page.waitForURL(/OPStestList_list/, { timeout: 10000 });
    await page.waitForTimeout(2000);
    // 折叠 BUG 断言：筛选区/表头/分页完整渲染，表体容器高度未塌陷
    await expect(page.locator('input[placeholder="输入项目名称关键字"]:visible').first()).toBeVisible();
    const okHeader = await page.evaluate(() =>
      [...document.querySelectorAll('th')].some((t) => t.offsetWidth > 0 && t.innerText.trim() === '项目名称')
    );
    expect(okHeader, '返回后「项目名称」表头应可见（列表未折叠）').toBe(true);
    const bodyH = await page.evaluate(() => {
      const bw = document.querySelector('.el-table__body-wrapper');
      return bw ? bw.getBoundingClientRect().height : 0;
    });
    expect(bodyH, '返回后表体容器高度不应塌陷').toBeGreaterThan(300);
    // 返回后可重新查询出数据（当前已知行为：筛选重置回今天，重新放宽应仍可查）
    const total2 = await widen();
    expect(total2, '返回后重新放宽日期应能查出数据').toBeGreaterThan(0);
  });

  test('② 项目日报导出弹窗含「包含制作截图」开关 @estimate', async ({ page }) => {
    await page.goto('/project/project_list');
    await h.waitTableSettled(page);
    const detailBtn = page.locator('button:visible', { hasText: '查看详情' }).first();
    test.skip(!(await detailBtn.count()), '项目列表无「查看详情」行（测试库刷新后重扫）');
    await detailBtn.click();
    await page.waitForTimeout(2000);
    // 项目日报弹窗 → 导出
    const exportBtn = page.locator('.el-dialog__wrapper:visible button', { hasText: '导出' }).first();
    await expect(exportBtn, '项目日报弹窗应有「导出」按钮').toBeVisible();
    await exportBtn.click();
    await page.waitForTimeout(1200);
    const dlg = page.locator('.el-dialog__wrapper:visible', { hasText: '导出项目日报' }).last();
    await expect(dlg, '应弹出「导出项目日报」配置弹窗').toBeVisible();
    const text = await dlg.innerText();
    expect(text, '配置弹窗应含时间范围提示').toContain('不选择时间则默认导出全部数据');
    expect(text, '配置弹窗应含「包含制作截图」开关').toContain('包含制作截图');
    expect(text, '配置弹窗应含文件过大告警文案').toContain('包含图片可能会导致文件过大');
    await expect(dlg.locator('.el-switch').first(), '截图开关应为 el-switch').toBeVisible();
  });

  test('③ 通用批量表单：批量添加反馈为两步向导容器 @produce_demand', async ({ page }) => {
    // my_board 子页直接 URL 会被重定向，必须点左侧菜单（entry_map 坑）
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    await page.locator('li.el-menu-item:visible').filter({ hasText: /^\s*我的反馈\s*$/ }).first().click();
    await page.waitForTimeout(2500);
    await h.dismissAnnouncement(page);
    await page.locator('button:visible', { hasText: '添加反馈' }).first().click();
    await page.waitForTimeout(800);
    await page.locator('li:visible', { hasText: '批量添加反馈' }).last().click();
    await page.waitForTimeout(1500);
    const dlg = page.locator('.el-dialog__wrapper:visible', { hasText: '批量添加项目反馈' }).last();
    await expect(dlg, '应弹出「批量添加项目反馈」').toBeVisible();
    const text = await dlg.innerText();
    // 通用批量容器要素：两步向导 + 条目栏 + 全清 + 有效计数 + 禁用下一步
    for (const key of ['录入反馈', '确认提交', '全清', '有效 0', '新增反馈']) {
      expect(text, `批量容器应含「${key}」`).toContain(key);
    }
    const next = dlg.locator('button', { hasText: '下一步' });
    await expect(next, '0 条有效时下一步应禁用').toBeDisabled();
    await page.keyboard.press('Escape');
  });

  // ③b 可见性断言为纯接口逻辑，已沉淀在 api-v2.2.3.spec.js「我的反馈可见性」用例，不在 UI spec 重复

  test('④ 主题面板 18 主题齐全且切换生效 @pm_theme', async ({ page }) => {
    // 坑：storageState 会话下直接 goto /main 渲染空壳（仅水印），子路由正常 → 用项目列表页作载体
    await page.goto('/project/project_list');
    await h.waitTableSettled(page);
    await page.waitForSelector('.ts-trigger', { timeout: 15000 });
    await page.locator('.ts-trigger:visible').first().click();
    await page.waitForTimeout(1000);
    const panel = page.locator('.el-popover:visible', { hasText: '基础皮肤' }).last();
    await expect(panel, '主题面板应打开').toBeVisible();
    const text = await panel.innerText();
    for (const t of ['海盐白', '春日花语', '夏日海滩', '金秋物语', '冬日初雪', '极地蓝', '薰衣草紫', '玫瑰粉', '苹果绿', '日落橘', '春节', '元宵节', '五一劳动节', '六一儿童节', '端午节', '中秋节', '国庆节', '圣诞节', '节日粒子特效', '节日鼠标特效']) {
      expect(text, `主题面板应含「${t}」`).toContain(t);
    }
    // 切换一个主题验证配色跟随（--pm-primary 变量在 headless 下读取不稳，改断言激活菜单计算色），再切回原主题
    const readState = () =>
      page.evaluate(() => {
        const active = [...document.querySelectorAll('.el-menu-item')].find((m) => m.offsetParent && m.classList.contains('is-active'));
        return { theme: localStorage.getItem('pm_theme'), activeColor: active ? getComputedStyle(active).color : null };
      });
    const before = await readState();
    // el-popover 在多步交互间可能自动收起 → 切换前重新点开触发器，再用 rect 高度稳健定位面板
    await page.locator('.ts-trigger:visible').first().click();
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const ps = [...document.querySelectorAll('.el-popover')].filter((x) => x.innerText.includes('基础皮肤'));
      const p = ps.reverse().find((x) => x.getBoundingClientRect().height > 0) || ps[0];
      if (!p) return;
      [...p.querySelectorAll('div,span')].find((e) => e.innerText.trim().endsWith('极地蓝') && e.innerText.trim().length <= 7 && getComputedStyle(e).cursor === 'pointer')?.click();
    });
    await page.waitForTimeout(1200);
    const after = await readState();
    expect(after.theme, '切换后 pm_theme 应变化').toBe('arctic');
    expect(after.activeColor, '激活菜单色应跟随极地蓝主题').toBe('rgb(78, 170, 204)');
    // 恢复原主题
    if (before.theme && before.theme !== after.theme) {
      await page.locator('.ts-trigger:visible').first().click();
      await page.waitForTimeout(800);
      await page.evaluate((orig) => {
        const nameMap = { light: '海盐白', spring: '春日花语', midsummer: '夏日海滩', autumn: '金秋物语', winter: '冬日初雪', arctic: '极地蓝', lavender: '薰衣草紫', pink: '玫瑰粉', apple: '苹果绿', sunset: '日落橘', 'spring-festival': '春节', 'lantern-festival': '元宵节', 'labor-day': '五一劳动节', doraemon: '六一儿童节', 'dragon-boat': '端午节', 'mid-autumn': '中秋节', 'national-day': '国庆节', christmas: '圣诞节' };
        const ps = [...document.querySelectorAll('.el-popover')].filter((x) => x.innerText.includes('基础皮肤'));
        const p = ps.reverse().find((x) => x.getBoundingClientRect().height > 0) || ps[0];
        if (!p) return;
        [...p.querySelectorAll('div,span')].find((e) => e.innerText.trim().endsWith(nameMap[orig]) && e.innerText.trim().length <= 7 && getComputedStyle(e).cursor === 'pointer')?.click();
      }, before.theme);
      await page.waitForTimeout(800);
    }
  });
});
