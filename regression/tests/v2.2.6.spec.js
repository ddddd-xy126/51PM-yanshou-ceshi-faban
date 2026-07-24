// V2.2.6 五项功能回归（沉淀自 2026-07-15 Copilot 验收轮）
// 全部只读断言。数据依赖策略（2026-07-17 改造）：静态 UI 要素硬断言；依赖验收落库数据的部分
// 改为「动态发现→找不到 skip」——测试库会不定期整体刷新，硬依赖固定数据会每轮误报红。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('V2.2.6 回归', () => {
  test('① 我的任务日历重构：任务以内联卡片展示（含描述/工时）（动作型自造真验） @project_task', async ({ page, request }) => {
    // ⚠️ V2.2.9 我的任务日历整体重构（就地更新旧断言，2026-07-24）：
    //   旧版=点日期格弹右侧栏、栏内任务卡有「备注」字段；
    //   新版=页面含「任务日历/工时确认」两 tab，任务不再走侧栏，而是以内联 chip 直接渲染在日期格里，
    //   chip 文本形如「[项目] B/S二开-AI-引擎功能 | 8H」「[非项目] 平台研发-项目管理 | 4H」（任务描述+工时内联）。
    //   故断言从「点格出侧栏备注」改为「日历渲染出带 [项目]/[非项目] 标签 + 工时 的任务 chip」。
    const seed = await h.ensureMyCalendarTask(request);
    // 仅当账号本月 0 任务（测试库彻底刷新）才退最后兜底 skip
    test.skip(!seed.item, seed.reason || '当前账号本月无日历任务');

    await h.gotoMyTaskCalendar(page);
    await page.waitForTimeout(1500);
    // 1) 重构后的两 tab 静态存在
    const hasTabs = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      return txt.includes('任务日历') && txt.includes('工时确认');
    });
    expect(hasTabs, '我的任务日历应含「任务日历/工时确认」两 tab（V2.2.9 重构）').toBe(true);
    // 2) 日历格内渲染任务 chip：叶子文本形如「任务名 | NH」（任务描述+工时内联）
    const chip = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('*')].filter(
        (e) => e.children.length === 0 && /\|\s*[\d.]+\s*H/i.test(e.innerText || '') && e.offsetWidth > 0
      );
      return { count: nodes.length, sample: nodes[0]?.innerText.trim().slice(0, 40) || '' };
    });
    expect(chip.count, '日历应内联渲染带工时的任务 chip（形如「任务名 | NH」，接口已确认本月有任务）').toBeGreaterThan(0);
  });

  test('② 递交列表存在自动判定落库的「提前递交」记录 @project_publish', async ({ page }) => {
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

  test('③ 项目概况三个接口/测试文档位齐全且链接互不覆盖 @project_detail', async ({ page }) => {
    await h.gotoProjectPage(page, 'project_detail');
    // V2.2.9 起项目概况改折叠手风琴，三个文档位标签移入默认折叠的「项目信息」面板——断言前先展开
    await page.evaluate(() => {
      const head = [...document.querySelectorAll('*')].find(
        (e) => e.children.length === 0 && e.innerText?.trim() === '项目信息' && e.offsetWidth > 0
      );
      (head?.closest('[class*=head],[class*=title],[class*=collapse],[class*=panel]') || head)?.click();
    });
    await page.waitForTimeout(800);
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

  test('④ 会议动态待办事项含状态与负责人（动作型自造真验） @project_moment', async ({ page, request }) => {
    // 不依赖遗留验收数据：先按接口幂等造一条带待办负责人的会议动态，再验 UI 渲染（库刷新也真跑不 skip）。
    // 说明：待办「负责人字段落库」由 api-v2.2.6 同名用例权威校验（remark.userIds/userNames）；
    // 本 UI 用例验证渲染链路——自造的会议动态能在动态页显示其内容/待办/人员/状态。
    const projectId = 6644; // 贵州茅台，稳定存在
    const marker = 'V2.2.6回归-会议动态-待办负责人字段落库';
    const todoText = `${marker}-待办负责人字段验证`;
    await h.ensureMeetingMoment(request, { projectId, marker, todoText });

    await page.goto(`/project/project_moment?projectId=${projectId}`);
    await h.dismissAnnouncement(page);
    await page.waitForFunction((m) => document.body.innerText.includes(m), marker, { timeout: 15_000 });
    const text = await page.evaluate(() => document.body.innerText);
    expect(text, '动态页应渲染自造的会议动态内容').toContain(marker);
    expect(text, '会议动态应显示待办事项文本').toContain(todoText);
    expect(text, '待办负责人/参会人员应渲染姓名').toContain(h.CURRENT_USER.name); // 邓欣羽
    // 待办状态：卡片以「处理」动作按钮 + 计数「0/1」体现，列表态则为「待处理/进行中」
    expect(/待处理|处理|进行中|已处理/.test(text), '待办应显示状态标识').toBe(true);
  });

  test('⑤ 产能数据看板：分析页要素 + 小组看板色块可下钻 @data_export', async ({ page }) => {
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
