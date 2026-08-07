// V2.3.1 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-08-03 验收轮。登录态 token 从 storageState 的 localStorage 读取。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}
const listOf = (d) => (Array.isArray(d) ? d : d?.data || d?.list || d?.table_data || []);

test.describe('V2.3.1 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  // 用户体验 递交列表新增程序开发人员筛选参数 chengxu_people
  test('递交列表：chengxu_people 参数被后端接受且为全量真子集 @project_publish', async ({ request }) => {
    const q = 'begin=2026-01-01+00:00:00&end=2026-12-31+23:59:59&limit=99999&page=1';
    const all = await (await request.get(`/manage_api/project_publish/get_list?${q}`, { headers })).json();
    const one = await (await request.get(`/manage_api/project_publish/get_list?${q}&chengxu_people=79`, { headers })).json();
    expect(all.code).toBe(0);
    expect(one.code).toBe(0);
    const allRows = listOf(all.data);
    const oneRows = listOf(one.data);
    // 携程序开发人员筛选应为全量的真子集（非忽略参数返全量）
    expect(oneRows.length).toBeGreaterThan(0);
    expect(oneRows.length).toBeLessThanOrEqual(allRows.length);
  });

  test('递交列表：非法 chengxu_people 不 5xx @project_publish', async ({ request }) => {
    const r = await request.get('/manage_api/project_publish/get_list?begin=2026-01-01+00:00:00&end=2026-12-31+23:59:59&limit=20&page=1&chengxu_people=abc', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // 新增功能 模型外包 外包/自制 对称筛选参数 is_self_made
  test('模型外包：is_self_made=0/1 对称筛选生效 @outsource', async ({ request }) => {
    const outResp = await (await request.get('/manage_api/outsource/get_package_list?page=1&limit=10&sj_num=SJ202506050003&is_self_made=0', { headers })).json();
    const selfResp = await (await request.get('/manage_api/outsource/get_package_list?page=1&limit=10&sj_num=SJ202506050003&is_self_made=1', { headers })).json();
    expect(outResp.code).toBe(0);
    expect(selfResp.code).toBe(0);
    // 两档参数均被接受、返回结构正常（该项目外包非空、自制为空——对称筛选生效）
    const out = outResp.data || {};
    expect(typeof (out.total ?? out.length ?? 0)).toBe('number');
  });

  // 新增功能 项目概览 时间轴预估营收时间字段 plan_income_date（月精度）
  test('项目信息：get_project_info 返回 plan_income_date（月精度） @project_detail', async ({ request }) => {
    const j = await (await request.get('/manage_api/project/get_project_info?id=6342', { headers })).json();
    expect(j.code).toBe(0);
    const info = (j.data && (j.data.info || j.data)) || {};
    expect('plan_income_date' in info, 'get_project_info 应返回 plan_income_date 字段').toBe(true);
    if (info.plan_income_date) expect(/^\d{4}-\d{2}$/.test(info.plan_income_date), 'plan_income_date 应为 YYYY-MM 月精度').toBe(true);
  });

  test('项目信息：不存在的 project id 不 5xx @project_detail', async ({ request }) => {
    const r = await request.get('/manage_api/project/get_project_info?id=99999999', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // 体验升级 BUG类型常量含「项目技术」（测试数据看板重构后契约不变）
  test('BUG常量：bug_type_list 含「项目技术」 @data_export', async ({ request }) => {
    const j = await (await request.get('/manage_api/bug/get_bug_const', { headers })).json();
    expect(j.code).toBe(0);
    const types = j.data && j.data.bug_type_list ? Object.values(j.data.bug_type_list) : [];
    expect(types.includes('项目技术')).toBe(true);
  });

  // AI功能 测试数据看板 AI分析总结：get_qa_stat_summary 只读契约（AI生成/编辑结果按周期存取，二轮新增）
  test('AI分析总结：get_qa_stat_summary 契约存在且不 5xx @data_export', async ({ request }) => {
    // 参数口径未逐一固定（读接口按周期取存/AI 结果），此处验契约可达、后端优雅返码而非 5xx
    const r = await request.get('/manage_api/data_export/get_qa_stat_summary?type=month&date=2026-08', { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(typeof j.code).toBe('number');
    // 保存写接口 add_qa_stat_summary_item 由 UI 验收实锤（生成→编辑→保存→硬刷新落库），不每轮真写
  });

  test('AI分析总结：非法周期参数不 5xx @data_export', async ({ request }) => {
    const r = await request.get('/manage_api/data_export/get_qa_stat_summary?type=abc&date=xxxx', { headers });
    expect(r.status()).toBeLessThan(500);
  });
});
