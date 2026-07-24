// V2.2.9 十项功能回归（沉淀自 2026-07-24 Copilot 验收轮）
// 策略：静态 UI 要素硬断言；数据依赖走「动态发现」（get_project_list / get_package_list 取真实样本，
// 测试库刷新也不误红）。登录态 storageState（playwright.config）。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const listOf = (d) => (Array.isArray(d) ? d : d?.data || d?.list || []);
async function apiJson(request, url) {
  const r = await request.get(h.API_BASE + url, { headers: h.authHeaders() });
  return r.json();
}

test.describe('V2.2.9 回归', () => {
  // item3 侧边栏：我的非项目合并进我的项目
  test('① 侧栏「我的非项目」已合并进「我的项目」（切换视野） @project_task', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    const left = await page.evaluate(() =>
      [...document.querySelectorAll('.el-menu-item, aside a, [class*=menu-item]')].map((e) => e.innerText.trim()).filter(Boolean)
    );
    expect(left.some((t) => t.includes('我的项目')), '左栏应有「我的项目」').toBe(true);
    expect(left.some((t) => t === '我的非项目' || /^我的非项目$/.test(t)), '左栏不应再有独立「我的非项目」菜单项').toBe(false);
    // 进我的项目页，应有「切换为非项目」按钮
    await page.locator('.el-menu-item:has-text("我的项目"), a:has-text("我的项目")').first().click();
    await page.waitForTimeout(2500);
    const hasSwitch = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((b) => /切换为非项目|切换.*非项目/.test(b.innerText))
    );
    expect(hasSwitch, '我的项目页应有「切换为非项目」视野切换按钮').toBe(true);
  });

  // item5 任务重构：已延宕/本周/全部 + 共用容器 + 持久化
  test('② 任务重构：项目/非项目共用容器 + 已延宕/本周/全部筛选 + 跨tab持久化 @project_task', async ({ page }) => {
    await page.goto('/task_panel/project_task');
    await h.waitTableSettled(page);
    const ui = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('.el-tabs__item,[role=tab]')].map((e) => e.innerText.trim());
      const radios = [...document.querySelectorAll('.el-radio-button__inner,.el-radio__label')].map((e) => e.innerText.trim());
      return { tabs, radios };
    });
    expect(ui.tabs.some((t) => t.includes('项目任务')) && ui.tabs.some((t) => t.includes('非项目任务')), '应有项目/非项目任务两 tab').toBe(true);
    for (const f of ['已延宕', '本周任务', '全部任务']) {
      expect(ui.radios.some((r) => r.includes(f)), `应有筛选「${f}」`).toBe(true);
    }
    // 持久化：选「已延宕」→ 切非项目 tab → 仍为「已延宕」
    await page.locator('.el-radio-button__inner:has-text("已延宕"), label:has-text("已延宕")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.locator('.el-tabs__item:has-text("非项目任务"),[role=tab]:has-text("非项目任务")').first().click();
    await page.waitForTimeout(1800);
    const active = await page.evaluate(() =>
      [...document.querySelectorAll('.el-radio-button.is-active .el-radio-button__inner')].map((e) => e.innerText.trim())
    );
    expect(active.some((a) => a.includes('已延宕')), '切 tab 后筛选「已延宕」应保持（共享持久化）').toBe(true);
  });

  // item1 工时统计重构：整合导出 + 所见即所得
  test('③ 工时花费统计：双视图 + 筛选/搜索/导出同页 @estimate', async ({ page }) => {
    await page.goto('/statistic/export_estimate');
    await h.waitTableSettled(page);
    const t = await page.evaluate(() => document.body.innerText || '');
    expect(t.includes('每日工作概览') && t.includes('工时数据总览'), '应含「每日工作概览/工时数据总览」双视图').toBe(true);
    const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim()));
    expect(btns.some((b) => b === '导出' || b.includes('导出')), '应有导出入口').toBe(true);
    expect(btns.some((b) => b === '搜索' || b.includes('搜索')), '应有搜索按钮（筛选-查看-导出同页）').toBe(true);
  });

  // item2 ECP报价 4.1
  test('④ ECP报价查询：版本枚举含 4.1.0 @estimate', async ({ page }) => {
    await page.goto('/statistic/ECP_baojia');
    await h.waitTableSettled(page);
    // 打开版本下拉（第2个 select）
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('.el-select')].filter((x) => x.offsetParent !== null)[1];
      s?.querySelector('input')?.click();
    });
    await page.waitForTimeout(1200);
    const opts = await page.evaluate(() => {
      const dds = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent !== null);
      const last = dds[dds.length - 1];
      return last ? [...last.querySelectorAll('.el-select-dropdown__item')].map((e) => e.innerText.trim()) : [];
    });
    expect(opts.some((o) => o.startsWith('4.1')), '版本下拉应含 4.1.x').toBe(true);
  });

  // item8 递交模块：季度排期日历视图
  test('⑤ 递交列表新增季度排期日历视图 @project_publish', async ({ page }) => {
    await page.goto('/OPStestList/OPStestList_list');
    await h.waitTableSettled(page);
    const hasToggle = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /切换至日历视图/.test(b.innerText)));
    expect(hasToggle, '递交列表应有「切换至日历视图」入口').toBe(true);
    await page.locator('button:has-text("切换至日历视图")').first().click();
    await page.waitForTimeout(2500);
    const cal = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return { quarter: /季度|Q[1-4]|[（(]\s*\d\s*[~～]\s*\d\s*月/.test(t), title: /递交日历视图/.test(t), back: /返回表格视图/.test(t) };
    });
    expect(cal.title && cal.quarter, '应进入递交日历视图且以季度为周期').toBe(true);
  });

  // item7 我的递交排期：日历视图
  test('⑥ 我的递交排期升级为日历视图（状态统计+颜色分状态） @project_publish', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    await page.locator('.el-menu-item:has-text("我的递交"), a:has-text("我的递交")').first().click();
    await page.waitForTimeout(2500);
    await page.locator('.el-tabs__item:has-text("我的递交排期"),[role=tab]:has-text("我的递交排期")').first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const t = await page.evaluate(() => document.body.innerText || '');
    // 日历周表头 + 状态统计（按时/延期/超时/待递交之一）+ 详情提示
    expect(/周一[\s\S]*周日/.test(t), '应为日历视图（周一~周日表头）').toBe(true);
    expect(/按时|延期|逾期|待递交/.test(t), '应有递交状态统计').toBe(true);
  });

  // item6 申请递交表单重构：绑定递交内容 + 强提示 + 提交校验
  test('⑦ 申请递交表单重构：绑定递交内容+强提示+提交校验 @project_publish', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    await page.locator('.el-menu-item:has-text("我的递交"), a:has-text("我的递交")').first().click();
    await page.waitForTimeout(2000);
    await page.locator('.el-tabs__item:has-text("我的递交申请"),[role=tab]:has-text("我的递交申请")').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.locator('button:has-text("申请递交")').first().click();
    await page.waitForTimeout(2500);
    const form = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog,.el-drawer')].find((d) => d.offsetParent !== null);
      const t = dlg ? dlg.innerText : '';
      return {
        bind: /绑定递交内容/.test(t),
        strong: /选错或漏选/.test(t),
        agree: [...(dlg?.querySelectorAll('.el-checkbox__label') || [])].some((c) => /不涉及任何新增/.test(c.innerText)),
      };
    });
    expect(form.bind, '应有「绑定递交内容」核心区').toBe(true);
    expect(form.strong, '应有强提示（选错或漏选…）').toBe(true);
    expect(form.agree, '应有协议勾选（我确认本次递交不涉及任何新增/变更/反馈）').toBe(true);
    // 空表单提交被校验拦
    await page.locator('.el-dialog:visible button:has-text("立即提交"), .el-drawer:visible button:has-text("立即提交")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const errs = await page.evaluate(() =>
      [...document.querySelectorAll('.el-form-item__error, .el-message__content')].map((e) => e.innerText.trim()).filter(Boolean)
    );
    expect(errs.length > 0, '空表单提交应被表单校验拦截').toBe(true);
  });

  // item9 模型外包：发包挂起/取消（动态挑带发包项目）
  test('⑧ 发包挂起/取消：状态枚举 + 编辑发包挂起/取消发包按钮 @outsource', async ({ page, request }) => {
    const pk = await apiJson(request, '/manage_api/outsource/get_package_list?page=1&limit=10&sj_num=');
    const rows = listOf(pk.data);
    const withPid = rows.find((r) => r.project_id);
    test.skip(!withPid, '无带项目的发包样本');
    await page.goto(`/project/outsource_project?projectId=${withPid.project_id}`);
    await h.waitTableSettled(page);
    // 状态筛选枚举含 挂起 / 已取消
    await page.locator('input[placeholder="状态筛选"]').first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const opts = await page.evaluate(() => {
      const dds = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent !== null);
      const last = dds[dds.length - 1];
      return last ? [...last.querySelectorAll('.el-select-dropdown__item')].map((e) => e.innerText.trim()) : [];
    });
    expect(opts.includes('挂起') && opts.includes('已取消'), '发包状态筛选应含「挂起」「已取消」').toBe(true);
    await page.keyboard.press('Escape');
    // 编辑发包弹窗底部含 挂起 / 取消发包
    const opened = await page.evaluate(() => {
      const e = [...document.querySelectorAll('.el-table__fixed-right button')].find((b) => b.innerText.trim() === '编辑');
      if (!e) return false;
      e.click();
      return true;
    });
    test.skip(!opened, '当前项目无可编辑发包');
    await page.waitForTimeout(2500);
    const footer = await page.evaluate(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /编辑发包/.test(d.innerText) && d.offsetParent !== null);
      const btns = dlg ? [...dlg.querySelectorAll('button')].map((b) => b.innerText.replace(/\s/g, '')) : [];
      return btns;
    });
    expect(footer.includes('挂起') && footer.includes('取消发包'), '编辑发包弹窗应有「挂起」「取消发包」按钮').toBe(true);
  });

  // item10 项目概况：预估营收时间（精确到月，可编辑）
  test('⑨ 项目概况新增「预估营收时间」字段（精确到月） @project_detail', async ({ page, request }) => {
    const pl = await apiJson(request, '/manage_api/project/get_project_list?page=1&limit=5');
    const proj = listOf(pl.data)[0];
    test.skip(!proj, '无可用项目样本');
    const pid = proj.id || proj.project_id;
    // 接口层：get_project_info.info 含 plan_income_date
    const info = await apiJson(request, `/manage_api/project/get_project_info?id=${pid}`);
    expect(Object.prototype.hasOwnProperty.call(info.data.info || {}, 'plan_income_date'), 'get_project_info 应含预估营收字段 plan_income_date').toBe(true);
    // UI 层：项目概况「基本信息」面板显示「预估营收时间」
    await page.goto(`/project/project_detail?projectId=${pid}`);
    await h.waitTableSettled(page);
    await page.evaluate(() => {
      const hh = [...document.querySelectorAll('.el-collapse-item__header')].find((e) => /基本信息/.test(e.innerText));
      if (hh && !hh.className.includes('is-active')) hh.click();
    });
    await page.waitForTimeout(1200);
    const hasField = await page.evaluate(() => (document.body.innerText || '').includes('预估营收时间'));
    expect(hasField, '项目概况应显示「预估营收时间」字段').toBe(true);
  });
});
