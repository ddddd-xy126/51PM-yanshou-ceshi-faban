// V2.2.7 三项功能回归（沉淀自 2026-07-16 Copilot 验收轮）
// 数据前置：发包「皖江江南建筑模型发包」#24（项目 SJ202501130001）下有 V2.2.7 验收造的反馈 #520/521/522；
//          离职人员案例：贡井区国资管理平台 #6690 需求 #47294 下 2 条完工任务指派给已离职的林智威(#463)。
// ⚠️ 原测试项目 SJ202607100001 已随测试库刷新消失，#6712 现为真实项目「广西盛隆冶金项目增补」。
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const FEEDBACK_PACKAGE_ID = 24; // 皖江江南建筑模型发包（外包类，有反馈管理 tab）
const LEFT_USER_DEMAND_PROJECT = 6690; // 贡井区国资管理平台
const LEFT_USER_NAME = '林智威'; // 已离职（不在在职 get_user_select_list），历史任务指派人

test.describe('V2.2.7 回归', () => {
  test('① 反馈验收工作台：入口存在且队列/快捷键要素齐全', async ({ page }) => {
    await page.goto(`/project/outsource_detail?outsourcePackageId=${FEEDBACK_PACKAGE_ID}`);
    await h.waitTableSettled(page);
    // 非自制发包应有「反馈管理」tab
    await page.locator('button', { hasText: '反馈管理' }).first().click();
    await page.waitForTimeout(1200);
    const panelText = await page.evaluate(() => document.body.innerText);
    for (const key of ['创建反馈', '验收工作台', '待验收', '修改中', '已验收', '未受理']) {
      expect(panelText, `反馈面板应有「${key}」`).toContain(key);
    }
    // V2.2.7 验收造的反馈应在（已验收 2 条 + 修改中 1 条）
    await page.locator('.el-radio-button, [role=radio]', { hasText: '全部' }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const listText = await page.evaluate(() => document.body.innerText);
    expect(
      listText,
      '测试数据缺失：发包#24 应有 V2.2.7 验收创建的反馈（被清理需重建：批量创建反馈 3 条带截图）'
    ).toContain('V2.2.7验收-反馈1');
    // 打开工作台（坐标偏移环境下 locator.click 可能被 hit-target 拦截，focus+Enter 等效且稳定）
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('验收工作台'));
      b?.focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const boardText = await page.evaluate(() => document.body.innerText);
    if (boardText.includes('反馈验收工作台')) {
      // 队列有待验收数据时验工作台要素
      for (const key of ['A 通过', 'R 驳回', 'S 跳过', '已处理', '待验收队列', '问题反馈', '处理结果']) {
        expect(boardText, `工作台应有「${key}」`).toContain(key);
      }
      await page.keyboard.press('Escape');
    } else {
      // 队列空时应有明确空态提示（同样是正确行为）
      expect(boardText.includes('没有待验收') || (await page.evaluate(() => [...document.querySelectorAll('.el-message')].some((m) => m.innerText.includes('没有待验收')))), '空队列应提示「当前没有待验收的反馈」').toBeTruthy();
    }
  });

  test('② 项目需求：列宽拖动后表头表体不错位', async ({ page }) => {
    await h.gotoProjectPage(page, 'demand', 6690); // 用有需求数据的项目
    // 拖「标准价」列 +60px
    const pt = await page.evaluate(() => {
      const table = [...document.querySelectorAll('.el-table')].filter((t) => t.offsetWidth > 0)[0];
      const th = [...table.querySelectorAll('.el-table__header th')].find((t) => t.innerText.trim() === '标准价' && t.offsetWidth > 0);
      const r = th.getBoundingClientRect();
      return { x: r.right - 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.move(pt.x + 60, pt.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const verify = await page.evaluate(() => {
      const table = [...document.querySelectorAll('.el-table')].filter((t) => t.offsetWidth > 0)[0];
      const hc = [...table.querySelectorAll('.el-table__header colgroup col')].map((c) => c.width).filter((w) => w !== '0');
      const bc = [...table.querySelectorAll('.el-table__body colgroup col')].map((c) => c.width).filter((w) => w !== '0');
      const ths = [...table.querySelectorAll('.el-table__header-wrapper th')].filter((t) => t.offsetWidth > 0);
      const tds = [...table.querySelectorAll('.el-table__body-wrapper .el-table__body tr:first-child td')].filter((t) => t.offsetWidth > 0);
      const misalign = ths
        .slice(0, Math.min(ths.length, tds.length))
        .map((th, i) => Math.abs(th.getBoundingClientRect().x - tds[i].getBoundingClientRect().x))
        .filter((d) => d > 1);
      return {
        colsEqual: JSON.stringify(hc) === JSON.stringify(bc),
        headerW: table.querySelector('.el-table__header').offsetWidth,
        bodyW: table.querySelector('.el-table__body').offsetWidth,
        misalignCount: misalign.length,
      };
    });
    expect(verify.colsEqual, '拖动后 header/body colgroup 应逐列一致').toBe(true);
    expect(verify.headerW, '表头总宽应等于表体总宽').toBe(verify.bodyW);
    expect(verify.misalignCount, '逐列 x 坐标不应错位').toBe(0);
  });

  test('③ 离职人员历史完成任务的指派人姓名不消失', async ({ page }) => {
    await h.gotoProjectPage(page, 'demand', LEFT_USER_DEMAND_PROJECT);
    // 点需求名打开任务列表弹窗（固定列双份渲染：过滤可见 span；集成环境坐标偏移用 JS click 兜底）
    const opened = await page.evaluate(() => {
      const s = [...document.querySelectorAll('span.longText.title.link')].filter(
        (x) => x.offsetWidth > 0 && x.innerText.includes('L3-自然地形')
      )[0];
      if (!s) return false;
      s.click();
      return true;
    });
    expect(opened, '测试数据缺失：#6690 项目需求页应有「L3-自然地形」需求（#47294）').toBe(true);
    await h.waitVisibleDialog(page);
    const detail = await page.evaluate((leftName) => {
      const d = [...document.querySelectorAll('.el-dialog__wrapper')].filter((x) => x.offsetWidth > 0).pop();
      const headers = [...d.querySelectorAll('.el-table__header th')].map((t) => t.innerText.trim());
      const assignIdx = headers.findIndex((hd) => hd === '指派给');
      const rows = [...d.querySelectorAll('.el-table__body tr')].filter((r) => r.offsetWidth > 0);
      const assignees = rows.map((r) => [...r.querySelectorAll('td')][assignIdx]?.innerText.trim());
      const doneWithLeft = rows.filter((r) => r.innerText.includes('完成') && r.innerText.includes(leftName));
      return { assignIdx, rowCount: rows.length, hasLeftName: assignees.includes(leftName), doneWithLeftCount: doneWithLeft.length, blankAssign: assignees.filter((a) => !a).length };
    }, LEFT_USER_NAME);
    expect(detail.rowCount).toBeGreaterThan(0);
    expect(detail.hasLeftName, `已离职人员「${LEFT_USER_NAME}」的姓名应仍显示在指派给列`).toBe(true);
    expect(detail.doneWithLeftCount, '至少 1 条完工任务的指派人是离职人员').toBeGreaterThanOrEqual(1);
  });
});
