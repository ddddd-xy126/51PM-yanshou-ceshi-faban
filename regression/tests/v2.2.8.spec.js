// V2.2.8 六项功能回归（沉淀自 2026-07-16 Copilot 验收轮）
// 数据前置：需求自动暂停样本 = 贡井区国资管理平台 #6690 需求 #47299/#47289（状态 pause）；
//          超时递交样本 = 2026 全年 12 条（is_over_tb_time=1），随时间推移只增不减。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const PAUSE_DEMAND_PROJECT = 6690; // 贡井区国资管理平台（含自动转「暂停中」的需求）

test.describe('V2.2.8 回归', () => {
  test('① 递交列表「仅查看超时递交」筛选生效', async ({ page }) => {
    await page.goto('/OPStestList/OPStestList_list');
    await h.waitTableSettled(page);
    // 复选框存在（true-value=1 → is_over_tb_time）
    const label = page.locator('.el-checkbox:visible', { hasText: '仅查看超时递交' }).first();
    await expect(label, '递交筛选区应有「仅查看超时递交」复选框').toBeVisible();
    // 日期筛选 fill 不触发（entry_map 坑）→ vm form + search 方法设全年范围做对照
    const totals = await page.evaluate(async () => {
      const app = document.querySelector('#app').__vue__;
      let vm = null;
      const walk = (v, d) => { if (!v || d > 8) return; if (v.publish_status_list && !vm) vm = v; (v.$children || []).forEach((c) => walk(c, d + 1)); };
      walk(app, 0);
      const search = vm[Object.keys(vm.$options.methods).find((x) => /search/i.test(x))].bind(vm);
      const run = async (over) => {
        vm.searchDateRange = ['2026-01-01', '2026-12-31'];
        vm.form.begin = '2026-01-01 00:00:00';
        vm.form.end = '2026-12-31 23:59:59';
        vm.form.is_over_tb_time = over;
        vm.form.page = 1;
        search();
        await new Promise((r) => setTimeout(r, 2500));
        return vm.total;
      };
      const all = await run(-1);
      const over = await run(1);
      return { all, over };
    });
    expect(totals.over, '勾选超时筛选后应过滤出少量记录').toBeGreaterThan(0);
    expect(totals.over, '超时子集应远小于全量').toBeLessThan(totals.all);
  });

  test('② 项目人员看板：六维度/QA分组/场景下钻', async ({ page }) => {
    await page.goto('/statistic/pm_panel');
    await h.waitTableSettled(page);
    const text = await page.evaluate(() => document.body.innerText);
    // 维度切换栏（V2.2.8 新增 DTA资产、项目技术）
    for (const key of ['项目管理', '项目场景', '项目开发', '项目设计', '项目技术', 'DTA资产']) {
      expect(text, `人员看板维度栏应含「${key}」`).toContain(key);
    }
    // 项目管理维度含 QA 分组（V2.2.8 加入测试两位同事）
    expect(text).toContain('QA');
    expect(text, 'QA 分组应含丁毅（人员调整后重核）').toContain('丁毅');
    expect(text).toContain('陈中山');
    // 人员卡六指标
    for (const key of ['7天活跃', '超周无进展', '制作中', '已营收', '未开工']) expect(text).toContain(key);
    // 切「项目场景」维度并下钻场景A组员看板
    await page.evaluate(() => {
      [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.offsetWidth > 0 && e.innerText.trim() === '项目场景')[0]?.click();
    });
    await page.waitForTimeout(2500);
    const sceneText = await page.evaluate(() => document.body.innerText);
    for (const key of ['项目场景A', '项目场景B', '项目场景C', '项目场景D']) expect(sceneText).toContain(key);
    // 点场景名下钻（集成浏览器坐标偏移坑；headless Playwright 下真实点击可用）
    await page.locator('.psb-name.is-clickable', { hasText: '项目场景A' }).first().click();
    await page.waitForTimeout(2500);
    const drill = await page.evaluate(() => document.body.innerText);
    expect(drill, '点击场景A应展开组员看板').toContain('组员看板');
  });

  test('③ 项目需求：存在自动转「暂停中」的需求', async ({ page }) => {
    // 动态发现→写死ID→失效重扫：#6690 需求 #47299/#47289 为 2026-07 验收时的 pause 样本
    await h.gotoProjectPage(page, 'demand', PAUSE_DEMAND_PROJECT);
    // 「暂停中」可能在任意页：直接读 vm 全量接口数据断言（UI 文案由渲染层映射）
    const pauseInfo = await page.evaluate(async () => {
      const res = await fetch(
        `${location.origin.replace(/:\d+$/, '')}:8888/manage_api/demand/get_project_demand_list?project_id=6690&limit=100&page=1`,
        { headers: { Authorization: localStorage.oauthToken, token: localStorage.oauthToken } }
      ).catch(() => null);
      if (!res) return null; // CORS 拦截时回退 UI 断言
      const j = await res.json();
      const arr = j?.data?.data || [];
      return arr.filter((d) => d.status === 'pause').map((d) => d.id);
    });
    if (pauseInfo) {
      expect(
        pauseInfo.length,
        '测试数据缺失：#6690 应有自动暂停需求（失效则扫其他项目重找 status=pause 样本）'
      ).toBeGreaterThan(0);
    }
    // UI 层：遍历分页找「暂停中」文案
    let found = false;
    for (let p = 0; p < 3 && !found; p++) {
      const text = await page.evaluate(() => document.body.innerText);
      found = text.includes('暂停中');
      if (!found) {
        await page.evaluate(() => document.querySelector('.el-pagination .btn-next')?.click());
        await page.waitForTimeout(2000);
      }
    }
    expect(found, '需求列表完工状态列应显示「暂停中」').toBe(true);
  });

  test('④ 模型数据看板：总览要素与汇总自洽', async ({ page }) => {
    await page.goto('/statistic/outsource_panel');
    await h.waitTableSettled(page);
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    for (const key of ['模型数据总览', '模型明细', '发包数量', '发包金额', '资产数量', '资产评分', '不合格资产占比', '发包平均反馈数', '供应商质量评分排行榜', '省份数量热力分布']) {
      expect(text, `模型数据看板应含「${key}」`).toContain(key);
    }
    // 汇总自洽：发包数量 = 供应商 + 自制（读接口一致性归 api spec，此处 UI 粗核数字存在）
    expect(text).toMatch(/发包数量\s*\d+/);
  });

  test('⑤ 工作台 UGA 入口存在且级联多环境', async ({ page }) => {
    await page.goto('/my_board/main/main');
    await page.waitForSelector('.wb-trigger__text', { timeout: 15_000 });
    await h.dismissAnnouncement(page);
    await page.evaluate(() => {
      const el = document.querySelector('.wb-trigger__text');
      ['mouseenter', 'mouseover'].forEach((t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true })));
      el.click();
    });
    await page.waitForTimeout(1200);
    const menuText = await page.evaluate(() =>
      [...document.querySelectorAll('.workbench-pop')].filter((m) => m.offsetWidth > 0).map((m) => m.innerText).join('\n')
    );
    expect(menuText, '工作台菜单应含 UGA 入口').toContain('UGA');
    // hover 展开级联二级（uga-cascade-label）
    await page.evaluate(() => {
      const lbl = document.querySelector('.uga-cascade-label');
      ['mouseenter', 'mouseover'].forEach((t) => lbl.dispatchEvent(new MouseEvent(t, { bubbles: true })));
    });
    await page.waitForTimeout(1200);
    const sub = await page.evaluate(() =>
      [...document.querySelectorAll('.el-dropdown-menu')].filter((m) => m.offsetWidth > 0).map((m) => m.innerText).join('\n')
    );
    expect(sub, 'UGA 级联应含正式环境入口').toContain('正式');
  });
});
