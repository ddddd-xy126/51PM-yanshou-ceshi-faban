// V2.3.0 九项功能回归（沉淀自 2026-07-27 Copilot 验收轮）
// 策略：静态 UI 要素硬断言；数据依赖走「动作型自造」(ensureProblemMoment) 或动态发现，库刷新也不误红。
// 登录态 storageState（playwright.config）。接口层字段断言见 api-v2.3.0.spec.js。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const listOf = (d) => (Array.isArray(d) ? d : d?.data || d?.list || []);
async function apiJson(request, url) {
  const r = await request.get(h.API_BASE + url, { headers: h.authHeaders() });
  return r.json();
}
const PROBLEM_PROJECT_ID = 6644;

test.describe('V2.3.0 回归', () => {
  // 体验1 非项目层级重构：分类导航 + 项目行（需求/任务数）+ 需求层级对齐项目
  test('① 非项目重构：分类导航 + 项目行 + 需求层级对齐 @demand @project_task', async ({ page }) => {
    await page.goto('/not_project/list');
    await h.waitTableSettled(page);
    await h.dismissAnnouncement(page);
    const ui = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].map((b) => b.innerText.trim());
      const headers = [...document.querySelectorAll('.el-table__header th .cell')].map((e) => e.innerText.trim());
      return { btns, headers, bodyText: document.body.innerText };
    });
    // 分类导航（原非项目→分类）：至少含「全部」+ 若干分类按钮，且有「新建非项目」
    expect(ui.btns.some((b) => /全部\s*\d/.test(b)), '应有分类导航「全部 N」').toBe(true);
    expect(ui.btns.some((b) => b.includes('新建非项目')), '应有新建非项目入口').toBe(true);
    // 列表列头对齐项目层级（描述/规模/工时概览/创建人）
    expect(ui.headers.some((x) => x.includes('工时概览')), '列表应含工时概览列').toBe(true);
  });

  // 体验1 下钻：非项目下需求页表头对齐项目需求页（含需求性质）
  test('② 非项目下需求页表头对齐项目需求页（需求/描述/状态/需求性质） @demand', async ({ page, request }) => {
    const j = await apiJson(request, '/manage_api/not_project/get_list?page=1&limit=5&sj_num=&is_all=0');
    const np = listOf(j.data).find((x) => (x.demand_num || 0) > 0) || listOf(j.data)[0];
    test.skip(!np, '无可用非项目样本');
    await page.goto(`/not_project/not_project_demand?not_projectId=${np.id}`);
    await h.waitTableSettled(page);
    const headers = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__header th .cell')].map((e) => e.innerText.trim())
    );
    expect(headers.some((x) => x.includes('需求')), '应有需求列').toBe(true);
    expect(headers.some((x) => x.includes('需求性质')), '应有需求性质列（对齐项目需求页）').toBe(true);
    expect(headers.some((x) => x.includes('指派给')), '应有指派给列').toBe(true);
  });

  // 体验2 工时数据总览（真实模块，非 Mock）：切视图 + 指标卡 + 图表 + 数据自洽
  test('③ 工时数据总览：指标卡 + 任务类型/项目占比/请假分布图 + 数据自洽 @estimate', async ({ page }) => {
    await page.goto('/statistic/export_estimate');
    await h.waitTableSettled(page);
    // 切到工时数据总览并用 vm 设日期加载数据（date-picker fill 不触发，走组件方法）
    const loaded = await page.evaluate(async () => {
      const findByFile = (f) => {
        const seen = new Set(); const stack = [document.querySelector('#app')];
        while (stack.length) { const el = stack.shift(); if (!el || seen.has(el)) continue; seen.add(el);
          if (el.__vue__ && (el.__vue__.$options.__file || '') === f) return el.__vue__;
          for (const c of el.children) stack.push(c); }
        return null;
      };
      const idx = findByFile('src/views/routerViews/statistic/estimate/index.vue');
      if (!idx) return false;
      idx.setNav({ name: '工时数据总览' });
      await new Promise((r) => setTimeout(r, 1500));
      const panel = findByFile('src/views/routerViews/statistic/estimate/components/overview/HourOverviewPanel.vue');
      if (!panel) return false;
      panel.query.start_date = '2026-06-01'; panel.query.end_date = '2026-07-27';
      await panel.loadData();
      await new Promise((r) => setTimeout(r, 1500));
      return { total: panel.summary.total, project: panel.summary.project, notProject: panel.summary.not_project, leave: panel.summary.leave, dailyManage: panel.summary.daily_manage, leaveDist: panel.leaveDist };
    });
    expect(loaded, '应能定位 HourOverviewPanel 组件并加载数据').toBeTruthy();
    // 页面文本含总览标题与图表标题
    const t = await page.evaluate(() => document.body.innerText);
    expect(t.includes('任务类型花费工时分布'), '应有任务类型分布图').toBe(true);
    expect(t.includes('项目与非项目工时占比'), '应有项目/非项目占比图').toBe(true);
    expect(t.includes('工时投入 TOP5') || t.includes('TOP5'), '应有工时投入 TOP5').toBe(true);
    // 数据自洽：total = 项目 + 非项目；请假 = 各请假类型段和
    if (loaded.total > 0) {
      expect(Math.abs(loaded.total - (loaded.project + loaded.notProject))).toBeLessThan(0.01);
      const leaveSum = (loaded.leaveDist || []).reduce((s, x) => s + Number(x.value || 0), 0);
      expect(Math.abs(loaded.leave - leaveSum)).toBeLessThan(0.01);
    }
  });

  // 体验2 下钻：点任务类型扇区弹二级占比弹窗
  test('④ 工时数据总览：任务类型扇区下钻二级占比 @estimate', async ({ page }) => {
    await page.goto('/statistic/export_estimate');
    await h.waitTableSettled(page);
    const res = await page.evaluate(async () => {
      const findByFile = (f) => {
        const seen = new Set(); const stack = [document.querySelector('#app')];
        while (stack.length) { const el = stack.shift(); if (!el || seen.has(el)) continue; seen.add(el);
          if (el.__vue__ && (el.__vue__.$options.__file || '') === f) return el.__vue__;
          for (const c of el.children) stack.push(c); }
        return null;
      };
      const idx = findByFile('src/views/routerViews/statistic/estimate/index.vue');
      idx.setNav({ name: '工时数据总览' });
      await new Promise((r) => setTimeout(r, 1200));
      const p = findByFile('src/views/routerViews/statistic/estimate/components/overview/HourOverviewPanel.vue');
      p.query.start_date = '2026-06-01'; p.query.end_date = '2026-07-27';
      await p.loadData();
      await new Promise((r) => setTimeout(r, 1200));
      const first = (p.taskTypeRaw || [])[0];
      if (!first) return { skip: true };
      p.handleTaskTypeClick({ name: first.name, data: { option_id: first.option_id, name: first.name }, dataIndex: 0 });
      await new Promise((r) => setTimeout(r, 800));
      return { drillVisible: p.drillVisible, children: (p.drillChildren || []).length, parent: first.name, parentVal: first.value, childrenSum: (first.children || []).reduce((s, c) => s + Number(c.value || 0), 0) };
    });
    test.skip(res.skip, '该区间无任务类型数据');
    expect(res.drillVisible, '点扇区应弹二级占比下钻').toBe(true);
    // 二级和 = 一级值（自洽）
    if (res.childrenSum > 0) expect(Math.abs(res.parentVal - res.childrenSum)).toBeLessThan(0.01);
  });

  // 新增1 每日工作概览：新增需求名称/需求性质列（不参与发版初稿）
  test('⑤ 每日工作概览：表头含需求名称/需求性质 @estimate', async ({ page }) => {
    await page.goto('/statistic/export_estimate');
    await h.waitTableSettled(page);
    const headers = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__header th .cell, thead th')].map((e) => e.innerText.trim()).filter(Boolean)
    );
    expect(headers.some((x) => x.includes('需求名称')), '每日工作概览应含需求名称列').toBe(true);
    expect(headers.some((x) => x.includes('需求性质')), '每日工作概览应含需求性质列').toBe(true);
  });

  // 新增2 项目问题：动作型自造 → 卡片展示 + 添加动态弹窗问题表单字段
  test('⑥ 项目问题：卡片展示 + 添加动态含问题动态表单 @project_moment', async ({ page, request }) => {
    await h.ensureProblemMoment(request, { projectId: PROBLEM_PROJECT_ID, marker: 'V2.3.0回归-项目问题卡片', user: h.CURRENT_USER });
    await page.goto(`/project/project_moment?projectId=${PROBLEM_PROJECT_ID}`);
    await h.waitTableSettled(page);
    await h.dismissAnnouncement(page);
    // 顶部筛选含「问题」；卡片区含问题类型/影响/状态
    const t = await page.evaluate(() => document.body.innerText);
    expect(/问题\s*\d/.test(t), '顶部应有「问题 N」筛选计数').toBe(true);
    expect(t.includes('需关注'), '问题卡片应含「需关注」人员').toBe(true);
    // 打开「添加动态」→「问题动态」tab，验表单必填字段
    await page.locator('button:has-text("添加动态")').first().click();
    await h.waitVisibleDialog(page);
    await page.locator('[role=tab]:has-text("问题动态"), .el-tabs__item:has-text("问题动态")').first().click();
    await page.waitForTimeout(800);
    const labels = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent);
      return [...d.querySelectorAll('.el-form-item__label')].map((e) => e.innerText.trim()).filter(Boolean);
    });
    for (const f of ['问题类型', '问题描述', '影响程度', '问题关注人员']) {
      expect(labels.some((l) => l.includes(f)), `问题动态表单应含「${f}」`).toBe(true);
    }
  });

  // 新增2.2 我的仪表盘相关项目动态改结果卡 → 跳转左栏「我的动态」集中管理（V2.3.1 重构）
  test('⑦ 我的动态：仪表盘相关项目动态结果卡 + 我的动态筛选/切换/添加 @project_moment', async ({ page, request }) => {
    await h.ensureProblemMoment(request, { projectId: PROBLEM_PROJECT_ID, marker: 'V2.3.0回归-项目问题卡片', user: h.CURRENT_USER });
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    // V2.3.1：原「未解决项目问题」卡改为「相关项目动态」结果记录卡 + 左栏新增「我的动态」
    const dash = await page.evaluate(() => ({
      hasMoment: document.body.innerText.includes('相关项目动态'),
      hasMenu: [...document.querySelectorAll('.el-menu-item')].some((e) => e.innerText.trim() === '我的动态'),
    }));
    expect(dash.hasMoment, '仪表盘应有「相关项目动态」结果卡').toBe(true);
    expect(dash.hasMenu, '左栏应新增「我的动态」菜单').toBe(true);
    // 进入我的动态页（直接 URL 会重定向，点左栏菜单）
    await page.locator('.el-menu-item:has-text("我的动态")').last().click().catch(() => {});
    await page.waitForTimeout(3000);
    if (!page.url().includes('moments')) { await page.goto('/my_board/main/moments'); await page.waitForTimeout(3000); }
    await h.dismissAnnouncement(page);
    // 会议/风险/问题计数为异步加载，等其出现再断言（V2.3.1 二轮：仅 waitForTimeout 3s 偶发未就绪误红）
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return /会议\s*\d/.test(t) && /风险\s*\d/.test(t) && /问题\s*\d/.test(t);
    }, { timeout: 15000 }).catch(() => {});
    const moments = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        hasFilters: /会议\s*\d/.test(t) && /风险\s*\d/.test(t) && /问题\s*\d/.test(t),
        hasScopeToggle: t.includes('全部动态') && t.includes('与我相关'),
        hasAdd: [...document.querySelectorAll('button')].some((b) => b.innerText.includes('添加动态')),
        hasSearch: [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('按项目搜索')),
      };
    });
    expect(moments.hasFilters, '我的动态应有会议/风险/问题筛选计数').toBe(true);
    expect(moments.hasScopeToggle, '我的动态应有「全部动态/与我相关」切换').toBe(true);
    expect(moments.hasAdd, '我的动态应有「添加动态」').toBe(true);
    expect(moments.hasSearch, '我的动态应有「按项目搜索」').toBe(true);
  });

  // 体验3 我的任务日历右侧任务栏 UI 重构
  test('⑧ 我的任务日历右侧任务栏重构（点日期出任务卡） @project_task', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await page.waitForSelector('li.el-menu-item', { timeout: 15000 });
    await h.dismissAnnouncement(page);
    await page.locator('.el-menu-item:has-text("我的任务")').first().click();
    await page.waitForTimeout(4000);
    // 顶部状态筛选 + 图例
    const t = await page.evaluate(() => document.body.innerText);
    expect(t.includes('进行中') && t.includes('已完工'), '日历应有状态筛选（进行中/已完工）').toBe(true);
    // 点本月有任务的格 → 右侧任务栏 tc-panel
    const opened = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.tc-cell:not(.is-other-month)')].filter((c) => c.querySelector('.tc-cell__bars') && c.querySelector('.tc-cell__bars').innerText.trim());
      if (!cells[0]) return false;
      cells[0].click();
      return true;
    });
    test.skip(!opened, '本月无带任务日期格');
    await page.waitForTimeout(1500);
    const panel = await page.evaluate(() => {
      const p = document.querySelector('.tc-panel');
      if (!p) return null;
      return { hasCreate: /快速创建/.test(p.innerText), hasFillHour: [...p.querySelectorAll('button')].some((b) => b.innerText.includes('填工时')), hasCount: /共\s*\d+\s*个任务/.test(p.innerText) };
    });
    expect(panel, '点日期格应展开右侧任务栏 tc-panel').toBeTruthy();
    expect(panel.hasCount, '任务栏头部应显示任务计数').toBe(true);
    expect(panel.hasFillHour, '任务卡应含「填工时」操作').toBe(true);
  });

  // 新增3 模型外包打分：质量评分≤3 必填备注（不参与发版初稿）
  test('⑨ 模型外包打分：质量评分≤3 备注变必填 + 空备注拦截 @outsource', async ({ page, request }) => {
    // 动态找一个有「已完工资产」可打分的制作中发包（打开结项评价能进评分区）
    const pl = await apiJson(request, '/manage_api/outsource/get_package_list?page=1&limit=200&sj_num=');
    const pkgs = listOf(pl.data).filter((p) => p.status == 4);
    let target = null;
    for (const p of pkgs) {
      const tj = await apiJson(request, `/manage_api/outsource_task/get_task_list?outsource_package_id=${p.id}`);
      const tasks = listOf(tj.data);
      if (tasks.some((t) => t.status == 2)) { target = p; break; } // status=2 已完工
    }
    test.skip(!target, '无「含已完工任务的制作中发包」样本，无法验打分');
    await page.goto(`/project/outsource_project?projectId=${target.project_id}`);
    await h.waitTableSettled(page);
    await h.dismissAnnouncement(page);
    // 遍历「打分」按钮，找到打开后含「已完工资产」评分区（el-rate）的那个发包
    const scoreBtnCount = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === '打分' && b.offsetParent).length);
    let opened = false;
    for (let i = 0; i < scoreBtnCount && !opened; i++) {
      await page.evaluate((idx) => { const bs = [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === '打分' && b.offsetParent); if (bs[idx]) bs[idx].click(); }, i);
      await page.waitForTimeout(1800);
      const hasRatePanel = await page.evaluate(() => !!document.querySelector('.cpd-task-item'));
      if (hasRatePanel) { opened = true; break; }
      // 关闭当前弹窗再试下一个
      await page.evaluate(() => { const c = [...document.querySelectorAll('.el-dialog__headerbtn')].find((b) => b.offsetParent); if (c) c.click(); });
      await page.waitForTimeout(800);
    }
    test.skip(!opened, '发包结项评价弹窗无已完工资产任务，无法验打分（数据态）');
    // 切到一个待评价任务
    await page.evaluate(() => { const it = [...document.querySelectorAll('.cpd-task-item')].find((e) => /待评价/.test(e.innerText)) || [...document.querySelectorAll('.cpd-task-item')].find((e) => !/已评/.test(e.innerText)); if (it) (it.querySelector('.cpd-task-item__body') || it).click(); });
    await page.waitForTimeout(1000);
    // 打质量评分 2 分：直调 el-rate 组件 selectValue（无头下星星 hover 点击不稳定）
    const rated = await page.evaluate(() => {
      const rateEl = document.querySelector('.cpd-main .el-rate');
      if (!rateEl || !rateEl.__vue__) return false;
      rateEl.__vue__.selectValue(2);
      return true;
    });
    test.skip(!rated, '未定位到评分组件');
    await page.waitForTimeout(800);
    const ph = await page.evaluate(() => { const ta = document.querySelector('.cpd-main textarea'); return ta ? ta.placeholder : ''; });
    expect(/必填/.test(ph), '评分≤3 时评语 placeholder 应含「必填」').toBe(true);
    // 空备注提交 → 拦截告警（el-message 会自动消失，轮询捕获）
    let warned = false;
    await page.evaluate(() => { const b = [...document.querySelectorAll('.cpd-main button, .el-dialog button')].find((x) => /提交评分/.test(x.innerText)); if (b) b.click(); });
    for (let i = 0; i < 12 && !warned; i++) {
      warned = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-message-box, .el-notification')].some((e) => /3\s*分及以下|填写评语|说明原因|备注/.test(e.innerText)));
      if (!warned) await page.waitForTimeout(250);
    }
    expect(warned, '评分≤3 空备注提交应被拦截并提示').toBe(true);
  });

  // 新增4 BUG明细：BUG类型新增「项目技术」（不参与发版初稿；走接口断言，稳于 vm——V2.3.1 测试数据看板组件重构后旧 vm 路径失效）
  test('⑩ 添加Bug：Bug类型含「项目技术」 @data_export', async ({ request }) => {
    const j = await apiJson(request, '/manage_api/bug/get_bug_const');
    const types = j.data && j.data.bug_type_list ? Object.values(j.data.bug_type_list) : [];
    expect(types.includes('项目技术'), 'Bug类型（bug_type_list）应含「项目技术」').toBe(true);
  });
});
