// 51PM 回归公共封装 —— 沉淀自 V2.2.5 两轮验收实测（入口与坑详见 ../skills/entry_map.md）
const { expect } = require('@playwright/test');

const TEST_PROJECT_ID = 6712; // 邓欣羽的测试项目
const PUBLISH_DATA_PROJECT_ID = 6662; // 千岛湖升级优化项目（项目递交有历史数据）

/** 关掉版本更新公告弹窗（新会话首次进页会弹「知道了」，会挡住后续弹窗/点击） */
async function dismissAnnouncement(page) {
  await page
    .evaluate(() => {
      const dlgs = [...document.querySelectorAll('.announcement-dialog, .el-dialog__wrapper')].filter(
        (d) => d.offsetWidth > 0 && /版本更新|知道了/.test(d.innerText)
      );
      dlgs.forEach((d) => {
        const btn = [...d.querySelectorAll('button, span, div')].find(
          (b) => b.innerText.trim() === '知道了' && b.children.length === 0
        );
        (btn || d.querySelector('.el-dialog__headerbtn'))?.click();
      });
    })
    .catch(() => {});
  await page.waitForTimeout(400);
}

/** 等 Element-UI 表格出数据行（或空态） */
async function waitTableSettled(page) {
  await page
    .waitForSelector('.el-table__body tr, .el-table__empty-text', { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await dismissAnnouncement(page);
}

/** 直接导航到项目子页（坑：二级菜单点击偶发不路由，location.href 最稳） */
async function gotoProjectPage(page, route, projectId = TEST_PROJECT_ID) {
  await page.goto(`/project/${route}?projectId=${projectId}`);
  await waitTableSettled(page);
}

/** 进「我的地盘 → 我的任务」日历（坑：直接改 URL 会被重定向回 main，必须点左侧菜单） */
async function gotoMyTaskCalendar(page) {
  await page.goto('/my_board/main/main');
  await page.waitForTimeout(2000);
  await dismissAnnouncement(page);
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('li.el-menu-item')].find(
      (e) => e.innerText.trim() === '我的任务' && e.getBoundingClientRect().x < 100
    );
    if (!li) throw new Error('左侧栏未找到「我的任务」');
    li.click();
  });
  await page.waitForSelector('.tc-cell', { timeout: 15_000 });
}

/** 关闭所有可见 el-dialog（坑：headerbtn 有隐藏副本，只点可见的） */
async function closeAllDialogs(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll('.el-dialog__wrapper')]
      .filter((d) => d.offsetWidth > 0)
      .forEach((d) => d.querySelector('.el-dialog__headerbtn')?.click());
  });
  await page.waitForTimeout(600);
}

/** 等待“可见的”dialog 出现（坑：页面常驻多个隐藏 announcement-dialog，[role=dialog] 首个永远不可见） */
async function waitVisibleDialog(page, timeout = 12_000) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.el-dialog__wrapper, [role=dialog]')].some(
        (d) =>
          d.offsetWidth > 0 &&
          d.innerText.trim().length > 10 &&
          !d.className.includes('announcement') &&
          !/版本更新/.test(d.innerText.slice(0, 30))
      ),
    { timeout }
  );
  await page.waitForTimeout(600);
}

/**
 * 打开需求拆解向导（创建多人任务）。
 * 坑：操作列 el-icon-menu 因固定列双份渲染，第一个不可见，须过滤 offsetWidth>0。
 */
async function openDismantleWizard(page, projectId = TEST_PROJECT_ID) {
  await gotoProjectPage(page, 'demand', projectId);
  const opened = await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.el-table__body .el-icon-menu')].filter(
      (i) => i.offsetWidth > 0
    );
    icons[0]?.click();
    return icons.length > 0;
  });
  expect(opened, '项目需求页应有可拆解的需求行（若为空需先建需求）').toBe(true);
  await waitVisibleDialog(page);
}

/**
 * 在拆解向导中展开任务选项面板并切到「管理/会议/售前/培训 → 项目管理 → 项目会议」。
 * 坑：面板搜索只搜当前分组，必须先切分组；不要按 Escape（会关掉整个向导）。
 */
async function openMeetingOptions(page) {
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog__wrapper, [role=dialog]')]
      .filter((d) => d.offsetWidth > 0)
      .pop();
    const sel = [...dlg.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && e.innerText.trim() === '请选择任务选项'
    );
    sel?.click();
  });
  await page.waitForSelector('[role=tooltip] input[placeholder="搜索任务选项"]', {
    timeout: 8_000,
  });
  await page
    .locator('[role=tooltip] label:visible', { hasText: '管理/会议/售前/培训' })
    .first()
    .click();
  await page.waitForTimeout(600);
  // 坑：面板里「项目管理」是 li（listitem），「项目会议」等有子级的才是 menuitem
  await page.locator('[role=tooltip] li:visible', { hasText: '项目管理' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('[role=tooltip] [role=menuitem]:visible', { hasText: '项目会议' }).first().click();
  await page.waitForTimeout(600);
}

/** 打开日历第一个任务条的工时弹窗，再进「添加工时」表单 */
async function openAddTimesheetDialog(page) {
  await gotoMyTaskCalendar(page);
  await page.evaluate(() => document.querySelector('.tc-bar')?.click());
  await waitVisibleDialog(page);
  await page
    .locator('.el-dialog__wrapper:visible button', { hasText: '填写工时' })
    .first()
    .click();
  await page.waitForSelector('.el-dialog__wrapper:visible textarea', { timeout: 10_000 });
  await page.waitForTimeout(800);
}

module.exports = {
  TEST_PROJECT_ID,
  PUBLISH_DATA_PROJECT_ID,
  waitTableSettled,
  waitVisibleDialog,
  dismissAnnouncement,
  gotoProjectPage,
  gotoMyTaskCalendar,
  closeAllDialogs,
  openDismantleWizard,
  openMeetingOptions,
  openAddTimesheetDialog,
};
