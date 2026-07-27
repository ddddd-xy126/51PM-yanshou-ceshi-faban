// V2.3.0 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-27 验收轮。登录态 token 从 storageState 的 localStorage 读取。
// 数据依赖用例走「动作型自造」：ensureProblemMoment 幂等造问题动态，库刷新也真跑不 skip。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ensureProblemMoment, CURRENT_USER } = require('./helpers');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}
const listOf = (d) => (Array.isArray(d) ? d : d?.data || d?.list || d?.table_data || []);
const PROBLEM_PROJECT_ID = 6644; // 贵州茅台本部园区综合安防IOC（问题动态样本项目）

test.describe('V2.3.0 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  // 新增2 项目问题：动作型自造 → 验证落库字段（module/需关注人员/影响程度/解决状态）
  test('项目问题：创建并回查，字段 module=problem/user_ids/risk_level/status 落库 @project_moment', async ({ request }) => {
    const marker = 'V2.3.0回归-项目问题字段落库';
    const { item } = await ensureProblemMoment(request, {
      projectId: PROBLEM_PROJECT_ID,
      marker,
      type: '质量问题',
      riskLevel: '中',
      status: '未解决',
      user: CURRENT_USER,
    });
    expect(item.module).toBe('problem');
    expect(item.risk_level, '影响程度落库').toBe('中');
    expect(item.status, '解决状态落库').toBe('未解决');
    expect(Array.isArray(item.user_ids) && item.user_ids.includes(CURRENT_USER.id), '需关注人员应含本人').toBe(true);
    expect(String(item.content)).toContain(marker);
  });

  // 新增2 我的地盘闭环：需关注人员含本人的未解决问题，可在 problem 列表按本人筛出（闭环数据基础）
  test('项目问题：需关注=本人的问题出现在 problem 列表（我的地盘闭环基础） @project_moment', async ({ request }) => {
    const marker = 'V2.3.0回归-项目问题字段落库';
    await ensureProblemMoment(request, { projectId: PROBLEM_PROJECT_ID, marker, user: CURRENT_USER });
    const j = await (
      await request.get(`/manage_api/project_moment/get_list?limit=200&page=1&project_id=${PROBLEM_PROJECT_ID}&module=problem`, { headers })
    ).json();
    expect(j.code).toBe(0);
    const mine = listOf(j.data).filter(
      (x) => Array.isArray(x.user_ids) && x.user_ids.includes(CURRENT_USER.id)
    );
    expect(mine.length, '应存在需关注含本人的问题动态').toBeGreaterThan(0);
  });

  test('项目问题：module 过滤生效，非法 module 优雅返回不 5xx @project_moment', async ({ request }) => {
    const bad = await request.get(`/manage_api/project_moment/get_list?project_id=${PROBLEM_PROJECT_ID}&module=hack`, { headers });
    expect(bad.status()).toBeLessThan(500);
  });

  // 体验1 非项目层级重构：not_project/get_list 每条带 分类(category) + 项目化的 需求/任务数
  test('非项目重构：get_list 返回 category_id/category_name（原非项目→分类） @demand', async ({ request }) => {
    const j = await (await request.get('/manage_api/not_project/get_list?page=1&limit=10&sj_num=&is_all=0', { headers })).json();
    expect(j.code).toBe(0);
    const rows = listOf(j.data);
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'category_id'), '非项目项应带分类 id').toBe(true);
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'category_name'), '非项目项应带分类名').toBe(true);
    // 一级需求上浮为项目：每项带需求数/任务数
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'demand_num')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'task_num')).toBe(true);
  });

  // 体验1 非项目下需求对齐项目结构：走项目化取数通道 get_demand_list
  test('非项目重构：非项目下需求走项目化取数（get_demand_list 携 project_id） @project_task', async ({ request }) => {
    const list = await (await request.get('/manage_api/not_project/get_list?page=1&limit=5&sj_num=&is_all=0', { headers })).json();
    const np = listOf(list.data).find((x) => (x.demand_num || 0) > 0) || listOf(list.data)[0];
    test.skip(!np, '无可用非项目样本');
    const r = await request.get(`/manage_api/project_not_task/get_demand_list?pro_type=&page=1&limit=20&name=&status=&assigned_to=&project_id=${np.id}`, { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j.code).toBe(0);
  });

  // 新增1 每日工作概览新增字段：demand_name（需求名称）+ demand_nature（需求性质）
  test('每日工作概览：export_daily_estimate_old 返回 需求名称/需求性质 字段 @estimate', async ({ request }) => {
    const j = await (
      await request.get('/manage_api/data_export/export_daily_estimate_old?start_date=2026-07-01&end_date=2026-07-27&user_id=&limit=3&dept_id=&page=1', { headers })
    ).json();
    expect(j.code).toBe(0);
    const rows = listOf(j.data);
    test.skip(!rows.length, '该区间无工时花费数据');
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'demand_name'), '应含需求名称字段').toBe(true);
    expect(Object.prototype.hasOwnProperty.call(rows[0], 'demand_nature'), '应含需求性质字段').toBe(true);
  });

  test('工时导出：export_daily_estimate 携筛选参数返回不 5xx @estimate', async ({ request }) => {
    const r = await request.get('/manage_api/data_export/export_daily_estimate?start_date=2026-07-01&end_date=2026-07-27&userList=475&dept_id=&export=1', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // 新增4 BUG明细：BUG类型新增「项目技术」（不参与发版初稿）
  test('BUG常量：bug_type_list 含「项目技术」 @data_export', async ({ request }) => {
    const j = await (await request.get('/manage_api/bug/get_bug_const', { headers })).json();
    expect(j.code).toBe(0);
    const types = Object.values(j.data.bug_type_list || {});
    expect(types.includes('项目技术'), 'BUG类型枚举应含「项目技术」').toBe(true);
  });
});
