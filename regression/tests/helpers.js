// 51PM 回归公共封装 —— 沉淀自 V2.2.5 两轮验收实测（入口与坑详见 ../skills/entry_map.md）
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const TEST_PROJECT_ID = 6712; // ⚠️2026-07-16 测试库刷新后已易主为真实项目「广西盛隆冶金项目增补」（原邓欣羽测试项目记录消失）
const PUBLISH_DATA_PROJECT_ID = 6662; // 千岛湖升级优化项目（项目递交有历史数据）
const OUTSOURCE_PACKAGE_ID = 661; // 自制发包（V225copilot-自制发包复测）；外包反馈数据用 #24 皖江江南建筑模型发包
const CURRENT_USER = { id: 475, name: '邓欣羽' }; // 当前登录态用户（造数默认负责人/参会人）

/** 从 storageState 读 oauthToken（接口造数/断言用；与 api-*.spec.js 同源） */
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

/** 接口请求头（Bearer 登录态） */
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

// 后端 API 绝对地址：走 globalSetup 起的 localhost:8888 转发（→ start-proxy.js 的 TARGET_HOST）。
// 造数助手用绝对地址，不依赖各 spec 的 baseURL（UI spec 的 baseURL 是前端 7777，接口 spec 是 8888）。
const API_BASE = 'http://localhost:8888';

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
  await page.waitForSelector('li.el-menu-item', { timeout: 15_000 });
  await dismissAnnouncement(page);
  // 真实点击左侧栏「我的任务」（:visible 过滤隐藏副本；正则锚定避免误匹前缀同名项）
  await page
    .locator('li.el-menu-item:visible')
    .filter({ hasText: /^\s*我的任务\s*$/ })
    .first()
    .click();
  await page.waitForSelector('.tc-cell', { timeout: 15_000 });
}

/** 关闭所有可见 el-dialog（清理用途非交互断言，故保留 JS 批量关闭；headerbtn 有隐藏副本，只点可见的） */
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
 * 坑：操作列 el-icon-menu 因固定列双份渲染，第一个不可见，用 :visible 过滤。
 */
async function openDismantleWizard(page, projectId = TEST_PROJECT_ID) {
  await gotoProjectPage(page, 'demand', projectId);
  const icons = page.locator('.el-table__body .el-icon-menu:visible');
  const count = await icons.count();
  expect(count, '项目需求页应有可拆解的需求行（若为空需先建需求）').toBeGreaterThan(0);
  await icons.first().click();
  await waitVisibleDialog(page);
}

/**
 * 在拆解向导中展开任务选项面板并切到「管理/会议/售前/培训 → 项目管理 → 项目会议」。
 * 坑：面板搜索只搜当前分组，必须先切分组；不要按 Escape（会关掉整个向导）。
 */
async function openMeetingOptions(page) {
  await page
    .locator('.el-dialog__wrapper:visible')
    .last()
    .getByText('请选择任务选项', { exact: true })
    .click();
  await page.waitForSelector('[role=tooltip] input[placeholder="搜索任务选项"]', {
    timeout: 8_000,
  });
  // 以下三次点击靠 locator.click() 自带的可见/稳定性等待，不再需要固定 sleep
  await page
    .locator('[role=tooltip] label:visible', { hasText: '管理/会议/售前/培训' })
    .first()
    .click();
  // 坑：面板里「项目管理」是 li（listitem），「项目会议」等有子级的才是 menuitem
  await page.locator('[role=tooltip] li:visible', { hasText: '项目管理' }).first().click();
  await page.locator('[role=tooltip] [role=menuitem]:visible', { hasText: '项目会议' }).first().click();
}

/** 打开日历第一个任务条的工时弹窗，再进「添加工时」表单 */
async function openAddTimesheetDialog(page) {
  await gotoMyTaskCalendar(page);
  await page.locator('.tc-bar').first().click();
  await waitVisibleDialog(page);
  await page
    .locator('.el-dialog__wrapper:visible button', { hasText: '填写工时' })
    .first()
    .click();
  await page.waitForSelector('.el-dialog__wrapper:visible textarea', { timeout: 10_000 });
  await page.waitForTimeout(800);
}

/**
 * 幂等造数：确保项目下存在带指定 marker 的「会议动态」，且其待办含负责人字段。
 * 动作型自造真验，不依赖测试库残留数据（数据被刷新也不 skip）。
 * 端点：POST /manage_api/project_moment/add（module=meet）；remark 是待办 JSON 串，
 * userIds/userNames 即「待办负责人」落库字段（详见 ../skills/impact_map.md project_moment 簇）。
 * @param {import('@playwright/test').APIRequestContext} request Playwright request fixture
 * @param {{projectId?:number, marker:string, todoText?:string, user?:{id:number,name:string}}} opts
 * @returns {Promise<{seeded:boolean, item:object}>} seeded=本次是否新建；item=命中的会议动态
 */
async function ensureMeetingMoment(request, opts) {
  const {
    projectId = TEST_PROJECT_ID,
    marker,
    todoText = `${marker}-待办负责人字段验证`,
    user = CURRENT_USER,
  } = opts;
  const headers = authHeaders();
  const listUrl = `${API_BASE}/manage_api/project_moment/get_list?limit=100&page=1&project_id=${projectId}&module=meet`;

  const findByMarker = async () => {
    const res = await request.get(listUrl, { headers });
    expect(res.status(), 'get_list 应 200').toBe(200);
    const j = await res.json();
    expect(j.code, 'get_list code 应为 0（否则登录态失效，先跑 npm run check）').toBe(0);
    // 响应为 Laravel 分页结构：data.data 才是列表（data 上还有 total/per_page/current_page）
    const d = j.data;
    const list = Array.isArray(d) ? d : d.data || d.list || d.table_data || [];
    return list.find((x) => String(x.content || '').includes(marker)) || null;
  };

  const existing = await findByMarker();
  if (existing) return { seeded: false, item: existing };

  const payload = {
    type: '项目内审会',
    content: marker,
    remark: JSON.stringify([
      { text: todoText, status: '待处理', userIds: [user.id], userNames: [user.name] },
    ]),
    user_id: [user.id],
    create_time: '',
    create_by: null,
    create_name: '',
    module: 'meet',
    project_id: String(projectId),
  };
  const add = await request.post(`${API_BASE}/manage_api/project_moment/add`, { headers, data: payload });
  expect(add.status(), 'project_moment/add 应 200').toBe(200);
  const addJson = await add.json();
  expect(addJson.code, `创建会议动态失败：${addJson.msg || addJson.message || ''}`).toBe(0);

  const created = await findByMarker();
  expect(created, '造数后应能在列表查到该会议动态').toBeTruthy();
  return { seeded: true, item: created };
}

/**
 * 幂等造数：确保「模型外包」发包下存在带指定 marker 的反馈（含关联任务/模块/状态字段）。
 * 动作型自造真验，不依赖测试库残留反馈数据（被清也不 skip）。
 * 端点：POST /manage_api/outsource_feedback/create_feedback（扁平单条,新建 quality_status=0 未受理）；
 * 关联任务取自 outsource_task/get_task_list?outsource_package_id=N（发包下须有任务）。
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {{packageId:number, marker:string, module?:string}} opts
 * @returns {Promise<{seeded:boolean, item:object}>}
 */
async function ensureOutsourceFeedback(request, opts) {
  const { packageId, marker, module = '模型' } = opts;
  const headers = authHeaders();
  const listUrl = `${API_BASE}/manage_api/outsource_feedback/get_feedback_list?outsource_package_id=${packageId}&page=1&limit=999`;

  const findByMarker = async () => {
    const res = await request.get(listUrl, { headers });
    expect(res.status(), 'get_feedback_list 应 200').toBe(200);
    const j = await res.json();
    expect(j.code, 'get_feedback_list code 应为 0（否则登录态失效，先跑 npm run check）').toBe(0);
    const d = j.data;
    const list = Array.isArray(d) ? d : d.data || d.list || [];
    return list.find((x) => String(x.feedback_content || '').includes(marker)) || null;
  };

  const existing = await findByMarker();
  if (existing) return { seeded: false, item: existing };

  // 取发包下第一个任务做关联（create_feedback 必填 outsource_task_id）
  const tkRes = await request.get(
    `${API_BASE}/manage_api/outsource_task/get_task_list?outsource_package_id=${packageId}`,
    { headers }
  );
  const tkJson = await tkRes.json();
  const tasks = Array.isArray(tkJson.data) ? tkJson.data : tkJson.data?.data || [];
  expect(tasks.length, `发包#${packageId} 应有可关联任务（否则无法造反馈）`).toBeGreaterThan(0);

  const payload = {
    outsource_package_id: packageId,
    outsource_task_id: tasks[0].id,
    feedback_module: module,
    feedback_content: marker,
    screenshot_urls: '[]',
    issue_count: 0,
  };
  const add = await request.post(`${API_BASE}/manage_api/outsource_feedback/create_feedback`, {
    headers,
    data: payload,
  });
  expect(add.status(), 'create_feedback 应 200').toBe(200);
  const addJson = await add.json();
  expect(addJson.code, `创建反馈失败：${addJson.msg || addJson.message || ''}`).toBe(0);

  const created = await findByMarker();
  expect(created, '造数后应能在列表查到该反馈').toBeTruthy();
  return { seeded: true, item: created };
}

/**
 * 幂等造数：确保存在一条「本人提交 + 有 PM + 待PM审批 + 在我的列表可见」的反馈申请。
 * 动作型自造真验，验证的是「本人在有 PM 项目上新提交的申请应立即出现在我的列表」这一功能。
 * 端点：POST /manage_api/produce_demand/add_apply_demand（需有效 project_id+sj_num+非空 module）。
 * 幂等策略（关键：不复用任意「待PM审批」旧样本——历史存在 #487/#489 等「有PM却不可见」反常记录，
 * 复用它们会误红）：
 *   1) 先在 my_demand_list（我的可见列表）里找带本轮 marker 的自造样本→有则复用；
 *   2) 无则从 my_demand_list 里挑一条「本人+有PM」记录作**已被证明可见**的项目模板，在该项目上重提一条带 marker 的新申请；
 *   3) 造完确认新申请确实出现在 my_demand_list，返回它。
 * ⚠️ 若 my_demand_list 里没有任何「本人+有PM」记录（测试库彻底刷新），无可信模板 → 退回 skip。
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {{applicant?:string, marker?:string}} [opts]
 * @returns {Promise<{seeded:boolean, item:object|null, reason?:string}>}
 */
async function ensureApplyDemand(request, opts = {}) {
  const { applicant = CURRENT_USER.name, marker = 'V2.2.3回归-审批链-可见性自造样本' } = opts;
  const headers = authHeaders();
  const myUrl = `${API_BASE}/manage_api/produce_demand/get_my_demand_list?sj_num=&page=1&limit=100&pm_id=&apply_demand_module=&apply_demand_status=&start_date=&end_date=`;

  const fetchMyRows = async () => {
    const res = await request.get(myUrl, { headers });
    expect(res.status(), 'get_my_demand_list 应 200').toBe(200);
    const j = await res.json();
    expect(j.code, 'get_my_demand_list code 应为 0（否则登录态失效，先跑 npm run check）').toBe(0);
    const d = j.data;
    return Array.isArray(d) ? d : d.data || d.list || [];
  };

  let myRows = await fetchMyRows();

  // 1) 复用本轮 marker 的自造样本（仍在可见列表 + 仍待审批）
  const reuse = myRows.find(
    (x) => x.apply_name === applicant && x.pm && x.apply_demand_status === '待PM审批' && String(x.apply_demand_desc || '').includes(marker)
  );
  if (reuse) return { seeded: false, item: reuse };

  // 2) 从可见列表里挑「本人+有PM」记录作已被证明可见的项目模板（#487 反常样本排除）
  const template = myRows.find((x) => x.id !== 487 && x.apply_name === applicant && x.pm && x.project_id && x.sj_num);
  if (!template) {
    return { seeded: false, item: null, reason: '我的可见列表里无「本人+有PM」记录可作造数模板（测试库彻底刷新）' };
  }

  const modules = Array.isArray(template.apply_demand_module) && template.apply_demand_module.length
    ? template.apply_demand_module
    : ['其他'];
  const payload = {
    project_id: template.project_id,
    sj_num: template.sj_num,
    project_name: template.project_name || '',
    apply_demand_module: modules,
    apply_demand_desc: `${marker} ${new Date().toISOString().slice(0, 10)}`,
    apply_material_address: '',
    demand_url: [],
    _key: 1,
  };
  const add = await request.post(`${API_BASE}/manage_api/produce_demand/add_apply_demand`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: payload,
  });
  expect(add.status(), 'add_apply_demand 应 200').toBe(200);
  const addJson = await add.json();
  expect(addJson.code, `重提反馈申请失败：${addJson.msg || addJson.message || ''}`).toBe(0);

  // 3) 确认新申请出现在我的可见列表
  myRows = await fetchMyRows();
  const created = myRows.find(
    (x) => x.apply_name === applicant && x.apply_demand_status === '待PM审批' && String(x.apply_demand_desc || '').includes(marker)
  );
  expect(created, '新提交的「本人+有PM+待PM审批」申请应立即出现在我的可见列表').toBeTruthy();
  return { seeded: true, item: created };
}

/**
 * 动作型真验（读侧确认）：确保当前用户本月日历有可验证的任务，并挑一条带「备注」(desc) 的返回。
 * 「我的任务日历」按 assigned_to=当前用户 + 日期范围拉取，接口 main_panel/get_task_list（项目任务）
 * 与 main_panel/get_not_task_list（非项目任务，记录含 desc=任务描述=日历卡「备注」字段）。
 * ⚠️ 不做从零造数：造一条日历任务需 项目→需求→任务 整条父链，测试库全清时父需求也不存在，
 * 不划算；而本登录账号是活跃开发者账号，本月恒有任务（实测 4 项目任务+17 非项目任务）。
 * 故策略=接口确认真有任务→挑一条（优先带 desc）交 UI 精确点选验证；仅账号本月 0 任务（库彻底刷新）
 * 才返回 item=null 由调用方退最后兜底 skip。
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{item:object|null, hasDesc:boolean, monthRange:[string,string], reason?:string}>}
 */
async function ensureMyCalendarTask(request) {
  const headers = authHeaders();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sd = fmt(new Date(y, m, 1));
  const ed = fmt(new Date(y, m + 1, 0));

  const fetchList = async (url) => {
    const res = await request.get(url, { headers });
    expect(res.status(), `${url} 应 200`).toBe(200);
    const j = await res.json();
    expect(j.code, 'get_(not_)task_list code 应为 0（否则登录态失效，先跑 npm run check）').toBe(0);
    const d = j.data;
    return Array.isArray(d) ? d : d.data || d.list || [];
  };

  const projTasks = await fetchList(
    `${API_BASE}/manage_api/main_panel/get_task_list?limit=1000&page=1&sj_num=&is_income=-1&start_date=${sd}&end_date=${ed}`
  );
  const notTasks = await fetchList(
    `${API_BASE}/manage_api/main_panel/get_not_task_list?limit=1000&page=1&start_date=${sd}&end_date=${ed}`
  );
  const all = [...notTasks, ...projTasks]; // 非项目任务多带 desc，优先
  if (!all.length) {
    return { item: null, hasDesc: false, monthRange: [sd, ed], reason: '当前账号本月日历无任何任务（测试库彻底刷新），无法验证备注字段' };
  }
  const withDesc = all.find((t) => String(t.desc || '').trim());
  const picked = withDesc || all[0];
  return { item: picked, hasDesc: !!withDesc, monthRange: [sd, ed] };
}

/**
 * 动作型自造：确保存在「可拆解需求」的项目，返回其 projectId。
 * 需求拆解向导要求项目需求页有 wait/doing 状态的需求行（done/pause 不出拆解入口）。
 * 测试库刷新常把默认项目 #6712 的需求清空 → 动态挑候选项目里第一个有可拆解需求的。
 * 需求是 PM 系统丰富真实数据（多项目恒有），故读侧动态发现即可，不从零造（造需求需走 create_demand 表单页较重）。
 * 全部候选项目都无 wait/doing 需求（库彻底清）才返回 projectId=null，由调用方退最后兜底 skip。
 */
async function ensureDismantleableDemand(request, opts = {}) {
  const preferProjectId = opts.preferProjectId || TEST_PROJECT_ID;
  const candidates = opts.candidates || [6690, 6644, 6668, 6666, 6662];
  const headers = authHeaders();
  const check = async (pid) => {
    const res = await request.get(
      `${API_BASE}/manage_api/demand/get_project_demand_list?project_id=${pid}&limit=100&page=1`,
      { headers }
    );
    if (res.status() !== 200) return null;
    const j = await res.json().catch(() => null);
    if (!j || j.code !== 0) return null;
    const d = j.data;
    const list = Array.isArray(d) ? d : (d && (d.data || d.list || d.table_data)) || [];
    // 可拆解=wait/doing（终态 done/pause 无拆解入口 el-icon-menu）
    const dismantleable = list.filter((x) => x.status === 'wait' || x.status === 'doing');
    return dismantleable.length
      ? { projectId: pid, count: dismantleable.length, sample: dismantleable[0] }
      : null;
  };
  const pref = await check(preferProjectId);
  if (pref) return pref;
  for (const pid of candidates) {
    if (pid === preferProjectId) continue;
    const r = await check(pid);
    if (r) return r;
  }
  return { projectId: null, count: 0, sample: null };
}

/**
 * 取一个非项目需求 id（会议工时类，如「公司会议」）——非项目任务页 URL 必带 demandId。
 * 非项目需求是 PM 系统常驻真实数据（153+ 条），恒存在；全清才返回 null。
 */
async function ensureNotProjectDemand(request) {
  const res = await request.get(
    `${API_BASE}/manage_api/not_project/get_list?page=1&limit=20&sj_num=&is_all=0`,
    { headers: authHeaders() }
  );
  if (res.status() !== 200) return null;
  const j = await res.json().catch(() => null);
  if (!j || j.code !== 0) return null;
  const d = j.data;
  const list = Array.isArray(d) ? d : (d && (d.data || d.list || d.table_data)) || [];
  return list.length ? { demandId: list[0].id, name: list[0].name } : null;
}

/**
 * 打开「创建多人通用任务」弹窗（含「从组群导入」——V2.2.5 起该功能只在多人任务弹窗，需求拆解向导已无）。
 * 入口：非项目 → 需求任务页(/not_project/not_project_task?demandId=N) → 「创建任务」下拉 → 多人通用任务。
 * ⚠️「创建任务」是 el-dropdown（class el-dropdown-selfdefine），实测为 **点击触发**（hover 不弹）。
 */
async function openMultiPersonTaskDialog(page, demandId) {
  await page.goto(`/not_project/not_project_task?demandId=${demandId}`);
  await waitTableSettled(page);
  const btn = page
    .locator('button.el-dropdown-selfdefine:visible')
    .filter({ hasText: /创建任务/ })
    .first();
  await btn.click();
  await page.waitForSelector('.el-dropdown-menu__item:visible', { timeout: 8_000 });
  await page
    .locator('.el-dropdown-menu__item:visible', { hasText: '多人通用任务' })
    .first()
    .click();
  await waitVisibleDialog(page);
}

module.exports = {
  TEST_PROJECT_ID,
  PUBLISH_DATA_PROJECT_ID,
  OUTSOURCE_PACKAGE_ID,
  CURRENT_USER,
  getToken,
  authHeaders,
  ensureMeetingMoment,
  ensureOutsourceFeedback,
  ensureApplyDemand,
  ensureMyCalendarTask,
  ensureDismantleableDemand,
  ensureNotProjectDemand,
  openMultiPersonTaskDialog,
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
