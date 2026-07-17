// V2.2.6 五项功能回归（沉淀自 2026-07-15 Copilot 验收轮）
// 全部只读断言。数据依赖策略（2026-07-17 改造）：静态 UI 要素硬断言；依赖验收落库数据的部分
// 改为「动态发现→找不到 skip」——测试库会不定期整体刷新，硬依赖固定数据会每轮误报红。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('V2.2.6 回归', () => {
  test('① 我的任务日历任务卡显示任务描述（备注）', async ({ page }) => {
    await h.gotoMyTaskCalendar(page);
    // 找一个有任务的日历格点击（今天没有就找当月任一有任务格）
    const clicked = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.tc-cell')];
      const withTask = cells.find((c) => c.querySelector('[class*=task], [class*=item]') || /\dH|…/.test(c.innerText));
      if (!withTask) return false;
      withTask.click();
      return true;
    });
    // 数据前置：测试账号当月无任务（测试库刷新常态）→ skip 不报红；想恢复覆盖就给测试账号建任何一条任务
    test.skip(!clicked, '数据前置缺失：测试账号本月日历无任务，跳过备注字段验证');
    await page.waitForTimeout(1500);
    // 侧栏任务卡应有「备注」标签（V2.2.6 新增：备注=任务描述）
    const hasRemark = await page.evaluate(() =>
      [...document.querySelectorAll('*')].some(
        (e) => e.children.length === 0 && e.innerText?.trim() === '备注' && e.offsetWidth > 0
      )
    );
    expect(hasRemark, '任务卡片应显示「备注」（任务描述）字段').toBe(true);
  });

  test('② 递交列表存在自动判定落库的「提前递交」记录', async ({ page }) => {
    // 动态发现：不再硬依赖 #6712 的 V2.2.6 验收递交（测试库刷新已清），
    // 改用递交列表全库筛「提前递交」状态验自动判定机制仍在工作（任意一条即可）。
    await page.goto('/OPStestList/OPStestList_list');
    await h.waitTableSettled(page);
    const found = await page.evaluate(async () => {
      const app = document.querySelector('#app').__vue__;
      let vm = null;
      const walk = (v, d) => { if (!v || d > 8) return; if (v.publish_status_list && !vm) vm = v; (v.$children || []).forEach((c) => walk(c, d + 1)); };
      walk(app, 0);
      vm.searchDateRange = ['2026-01-01', '2026-12-31'];
      vm.form.begin = '2026-01-01 00:00:00';
      vm.form.end = '2026-12-31 23:59:59';
      vm.form.publish_submit_status = 2; // 提前递交（枚举序：0未/1正常/2提前/3延期/4PM）
      vm.form.page = 1;
      vm[Object.keys(vm.$options.methods).find((x) => /search/i.test(x))]();
      await new Promise((r) => setTimeout(r, 2500));
      return { total: vm.total, hasText: document.body.innerText.includes('提前递交') };
    });
    expect(found.total, '全库应存在至少一条「提前递交」记录（自动判定机制落库证据）').toBeGreaterThan(0);
    expect(found.hasText).toBe(true);
  });

  test('③ 项目概况三个接口/测试文档位齐全且链接互不覆盖', async ({ page }) => {
    await h.gotoProjectPage(page, 'project_detail');
    // 静态要素：三个文档位标签常驻（不依赖数据，硬断言）
    const info = await page.evaluate(() => document.body.innerText);
    for (const label of ['定制接口文档', '项目测试文档', '行业接口文档']) {
      expect(info, `项目信息栏应有「${label}」文档位`).toContain(label);
    }
    // 数据依赖：已上传的文档链接（测试库刷新会清）——有链接才验「互不覆盖」，无链接 skip
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="projectapi.51aes.com"]')].map((a) => a.href)
    );
    test.skip(links.length < 2, '数据前置缺失：接口文档链接不足 2 条（测试库刷新被清），跳过互不覆盖验证；恢复覆盖需重传定制+行业两份文档');
    expect(new Set(links).size).toBe(links.length); // 链接互不相同=互不覆盖
  });

  test('④ 会议动态待办事项含状态与负责人', async ({ page }) => {
    await h.gotoProjectPage(page, 'project_moment');
    const rowText = await page.evaluate(() => document.querySelector('.el-table__body')?.innerText || '');
    expect(
      rowText,
      '测试数据缺失：#6712 项目动态应有 V2.2.6 验收创建的会议动态（被清理需重建）'
    ).toContain('验证待办负责人字段落库');
    // 待办列应同时回显 状态 + 负责人
    expect(rowText).toContain('进行中');
    expect(rowText).toContain('邓欣羽');
    expect(rowText).toContain('待处理'); // 无负责人边界待办的默认状态
  });

  test('⑤ 产能数据看板：分析页要素 + 小组看板色块可下钻', async ({ page }) => {
    await page.goto('/statistic/capacity_analysis');
    await h.waitTableSettled(page);
    const text = await page.evaluate(() => document.body.innerText);
    // 工程产能分析（部门维度）新要素
    for (const key of ['工程产能分析', '小组产能看板', '非生产成员过滤', '总产能上限', '总待消耗人天', '产能消耗情况']) {
      expect(text, `产能分析页应包含「${key}」`).toContain(key);
    }
    // 三项细分统计
    for (const key of ['进行中', '暂停', '未开工']) expect(text).toContain(key);
    // 切到小组产能看板
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('*')]
        .filter((e) => e.children.length === 0 && e.innerText?.trim() === '小组产能看板' && e.offsetWidth > 0)
        .pop();
      el?.click();
    });
    await page.waitForSelector('.bar-seg--clickable', { timeout: 15_000 });
    // 点击第一个色块应弹需求列表详情
    await page.evaluate(() => document.querySelector('.bar-seg--clickable')?.click());
    await page.waitForTimeout(2000);
    const dlgText = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')].filter((x) => x.offsetWidth > 0).pop();
      return d?.innerText || '';
    });
    expect(dlgText, '点击色块应弹出需求列表详情').toContain('需求列表');
    expect(dlgText).toContain('待消耗');
  });
});
