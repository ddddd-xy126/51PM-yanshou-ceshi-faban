// V2.2.5 八项功能回归（沉淀自 2026-07-10 Hermes 首轮 + 2026-07-14 Copilot 复测轮）
// 设计原则：默认全部只读断言（不产生测试数据）；带 @write 标签的完整写链路默认跳过，
// 需要时用 `npx playwright test --grep @write` 单独跑。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('V2.2.5 回归', () => {
  test('① 任务选项含「项目内审会」', async ({ page }) => {
    await h.openDismantleWizard(page);
    await h.openMeetingOptions(page);
    const meetingOpts = page.locator('[role=tooltip] [role=menuitem]:visible');
    await expect(meetingOpts.filter({ hasText: '项目内审会' })).toHaveCount(1);
    // 四个会议选项齐全
    for (const name of ['项目启动会', '项目融通会', '项目复盘会', '项目内审会']) {
      await expect(meetingOpts.filter({ hasText: name }).first()).toBeVisible();
    }
  });

  test('② 添加工时上传区支持 Ctrl+V 粘贴（文案与组件存在）', async ({ page }) => {
    await h.openAddTimesheetDialog(page);
    const dlgText = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')]
        .filter((x) => x.offsetWidth > 0)
        .pop();
      return d?.innerText || '';
    });
    expect(dlgText).toContain('Ctrl+V 粘贴');
  });

  test('② @write 真实粘贴上传', async ({ page }) => {
    test.skip(!process.env.RUN_WRITE, '写链路默认跳过，RUN_WRITE=1 或 --grep @write 时执行');
    await h.openAddTimesheetDialog(page);
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300; canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#2d6cdf'; ctx.fillRect(0, 0, 300, 150);
      ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
      ctx.fillText('回归-粘贴验证 ' + Date.now(), 10, 75);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'regression-paste.png', { type: 'image/png' }));
      const dlg = [...document.querySelectorAll('.el-dialog__wrapper')].filter((d) => d.offsetWidth > 0).pop();
      (dlg.querySelector('[class*=upload]') || dlg).dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
      );
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await expect(page.locator('.el-message', { hasText: '上传成功' }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('③ 模型外包：自制流程要素齐全', async ({ page }) => {
    await h.gotoProjectPage(page, 'outsource_project');
    // 申请发包按钮 + 全部/内部自制 tab
    await expect(page.locator('button', { hasText: '申请发包' }).first()).toBeVisible();
    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('[role=tab], .el-radio-button__inner')]
        .filter((e) => e.offsetWidth > 0)
        .map((e) => e.innerText.trim())
    );
    expect(tabs).toEqual(expect.arrayContaining(['全部', '内部自制']));
    // 表头含质量评分列
    const headers = await page.evaluate(() =>
      [...document.querySelectorAll('.el-table__header th')].map((t) => t.innerText.trim())
    );
    expect(headers).toContain('质量评分');
    // 已立项自制发包（V225copilot-自制发包复测）应有「打分」按钮
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('V225copilot-自制发包复测')) {
      expect(bodyText).toContain('打分');
      expect(bodyText).toContain('前往管理');
    }
  });

  test('③ 已知BUG跟踪：发包详情页「任务管理」按钮应有响应', async ({ page }) => {
    // V2.2.5-copilot 轮发现的 BUG：点击无响应。修复后本用例应转绿。
    await page.goto('/project/outsource_detail?outsourcePackageId=661&projectId=6712');
    await h.waitTableSettled(page);
    const btn = page.locator('button', { hasText: '任务管理' }).first();
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(2500);
    const reacted = await page.evaluate(
      () =>
        [...document.querySelectorAll('.el-dialog__wrapper, [role=dialog], .el-drawer__wrapper')].some(
          (d) => d.offsetWidth > 0
        ) || location.href.includes('task')
    );
    expect(reacted, '「任务管理」按钮点击应弹窗或路由（当前为已知BUG，修复前本用例红）').toBe(true);
  });

  test('④ 创建任务流程内可就地管理组群', async ({ page }) => {
    await h.openDismantleWizard(page);
    // 从组群导入 → popover（坑：JS 合成 click 触发不了 popover，必须真实鼠标点击）
    await page
      .locator('.el-dialog__wrapper:visible >> text=从组群导入')
      .last()
      .click();
    await page.waitForTimeout(1200);
    const tip = page.locator('[role=tooltip]', { hasText: '从组群添加指派人' });
    await expect(tip).toBeVisible();
    // 「立即管理」就地弹组群配置（不离开创建流程）
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('[role=tooltip]')].filter((e) => e.offsetWidth > 0).pop();
      [...t.querySelectorAll('*')].find((e) => e.children.length === 0 && e.innerText.trim() === '立即管理')?.click();
    });
    await page.waitForTimeout(1500);
    await expect(page.locator('.el-dialog__wrapper:visible', { hasText: '组群配置' }).last()).toBeVisible();
    await expect(page.locator('button:visible', { hasText: '新建分组' }).first()).toBeVisible();
    // 历史组群仍在（V225copilot验收组）
    const cfgText = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')]
        .filter((x) => x.offsetWidth > 0 && x.innerText.includes('组群配置'))
        .pop();
      return d?.innerText || '';
    });
    expect(cfgText).toContain('V225copilot验收组');
  });

  test('⑤ 日历点任务条直接弹花费填写，点日期格右侧栏保留', async ({ page }) => {
    await h.gotoMyTaskCalendar(page);
    // 点任务条 → 工时弹窗
    await page.evaluate(() => document.querySelector('.tc-bar')?.click());
    await page.waitForTimeout(1500);
    const dlg = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')].filter((x) => x.offsetWidth > 0).pop();
      return d?.innerText || '';
    });
    expect(dlg).toContain('填写工时');
    await h.closeAllDialogs(page);
    // 点日期格 → tc-panel 侧栏
    await page.evaluate(() => {
      const dates = [...document.querySelectorAll('.tc-cell__date')];
      (dates.find((e) => /^\d+$/.test(e.innerText.trim())) || dates[0])?.click();
    });
    await page.waitForTimeout(1200);
    await expect(page.locator('.tc-panel').first()).toBeVisible();
  });

  test('⑥ 添加工时表单：工时输入与描述框结构存在（兼容单/多子项）', async ({ page }) => {
    await h.openAddTimesheetDialog(page);
    const form = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')].filter((x) => x.offsetWidth > 0).pop();
      return {
        // 工时输入：多子项用 .option-hour-input，单任务用 el-input-number
        hourInputs: d.querySelectorAll('.option-hour-input input, .el-input-number input').length,
        textareas: d.querySelectorAll('textarea').length,
        hasTotal: /花费总计/.test(d.innerText),
      };
    });
    expect(form.hourInputs).toBeGreaterThan(0);
    expect(form.textareas).toBeGreaterThan(0);
    expect(form.hasTotal).toBe(true);
    // 注：完整"0工时提交+落库回读"是写操作，放在 @write；
    // "自动填写暂无"截至 2026-07-14 复测仍未实现（🐛），实现后在 @write 用例中补断言。
  });

  test('⑦ 任务列表「任务描述」列直显纯文本', async ({ page }) => {
    await page.goto('/task_panel/project_task');
    await h.waitTableSettled(page);
    const res = await page.evaluate(() => {
      const ths = [...document.querySelectorAll('.el-table__header th')];
      const descIdx = ths.findIndex((t) => t.innerText.trim() === '任务描述');
      const rows = [...document.querySelectorAll('.el-table__body tr')].filter((r) => r.offsetHeight > 0);
      const cells = rows.slice(0, 10).map((r) => {
        const td = [...r.querySelectorAll('td')][descIdx];
        return { hasBtn: !!td?.querySelector('button'), text: (td?.innerText || '').trim() };
      });
      return { descIdx, cells };
    });
    expect(res.descIdx).toBeGreaterThanOrEqual(0);
    for (const c of res.cells) expect(c.hasBtn, '描述列不应是按钮').toBe(false);
  });

  test('⑧ 项目递交模块：空态/统计/排序', async ({ page }) => {
    // 空态项目
    await page.goto(`/project/project_publish?projectId=${h.TEST_PROJECT_ID}`);
    await page.waitForTimeout(2500);
    await expect(page.locator('text=该项目暂无递交记录')).toBeVisible();
    // 有数据项目：统计与卡片
    await page.goto(`/project/project_publish?projectId=${h.PUBLISH_DATA_PROJECT_ID}`);
    await page.waitForTimeout(3000);
    const stats = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) =>
        /全部|按时|超时|延期|待递交/.test(b.innerText)
      );
      const total = document.body.innerText.match(/共 (\d+) 条/)?.[1];
      const all = btns.find((b) => b.innerText.includes('全部'))?.innerText.match(/\d+/)?.[0];
      return { total, all };
    });
    expect(stats.total).toBe(stats.all); // 「全部」统计数 = 列表总条数
    // 最新/最早排序切换首卡变化
    const firstDate = () =>
      page.evaluate(
        () => (document.querySelector('main') || document.body).innerText.match(/\d{1,2}\/\d{1,2}/)?.[0]
      );
    await page.locator('label:visible', { hasText: '最早' }).first().click();
    await page.waitForTimeout(1500);
    const earliest = await firstDate();
    await page.locator('label:visible', { hasText: '最新' }).first().click();
    await page.waitForTimeout(1500);
    const latest = await firstDate();
    expect(earliest).not.toBe(latest);
  });
});
