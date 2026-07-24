// V2.2.9 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-24 验收轮。登录态 token 从 storageState 的 localStorage 读取。
// 后端响应多为 Laravel 分页结构 {code,data:{total,...,data:[列表]}}；鉴权裸 token / Bearer 皆可。
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

test.describe('V2.2.9 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  // item2 ECP报价对接 4.1
  test('ECP报价：版本枚举含 4.1.0，按 version_id 过滤返回报价项 @estimate', async ({ request }) => {
    const cst = await (await request.get('/manage_api/data_export/get_ecp_baojia_const', { headers })).json();
    expect(cst.code).toBe(0);
    const aes = cst.data.version_list.aes || [];
    // version_list.aes 形如 [{"13":"4.1.0"},...]；断言含 4.1.0 且取其 id
    const v41 = aes.find((o) => Object.values(o).some((v) => String(v).startsWith('4.1')));
    expect(v41, '版本枚举应含 4.1.x').toBeTruthy();
    const v41Id = Object.keys(v41)[0];
    const list = await (
      await request.get(`/manage_api/data_export/get_ecp_baojia_list?page=1&limit=50&ywx=aes&version_id=${v41Id}`, { headers })
    ).json();
    expect(list.code).toBe(0);
    expect(list.data.total, '4.1 版本应有报价项数据').toBeGreaterThan(0);
  });

  test('ECP报价：非法 version_id 不 5xx @estimate', async ({ request }) => {
    const r = await request.get('/manage_api/data_export/get_ecp_baojia_list?page=1&limit=50&ywx=aes&version_id=abc', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // item1 工时统计-导出（所见即所得：导出携当前筛选）
  test('工时导出：export_daily_estimate 携筛选参数返回 200 @estimate', async ({ request }) => {
    // userList=1（华中豪）为筛选条件，导出即当前筛选结果
    const r = await request.get(
      '/manage_api/data_export/export_daily_estimate?start_date=2026-07-20&end_date=2026-07-24&userList=1&dept_id=&export=1',
      { headers }
    );
    expect(r.status(), '导出接口应正常响应（非 5xx）').toBeLessThan(500);
  });

  // item9 模型外包-发包挂起/取消：状态体系
  test('发包列表：get_package_list 返回带 status 的发包数据 @outsource', async ({ request }) => {
    const j = await (await request.get('/manage_api/outsource/get_package_list?page=1&limit=10&sj_num=', { headers })).json();
    expect(j.code).toBe(0);
    const rows = listOf(j.data);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('status'); // status 承载 挂起/已取消 等新状态
  });

  test('发包列表：非法 status 筛选不 5xx @outsource', async ({ request }) => {
    const r = await request.get('/manage_api/outsource/get_package_list?page=1&limit=10&sj_num=&status=abc', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  test('成本总览：已取消发包排除出统计（status_distribution 无「已取消」） @outsource', async ({ request }) => {
    // V2.2.9 实测：取消发包为终态且从 get_data_overview 聚合中排除（package_total/self_made_count 递减、
    // status_distribution 不出现「已取消」）。此处用只读契约固化「取消不计入成本统计」，避免每轮真取消发包。
    const ov = await (await request.get('/manage_api/outsource/get_data_overview', { headers })).json();
    expect(ov.code).toBe(0);
    const sd = ov.data.data.package_detail.status_distribution.map((s) => s.name);
    expect(sd.includes('已取消'), '成本总览状态分布不应包含「已取消」（取消发包已排除出成本统计）').toBe(false);
  });

  // item10 项目概况-预估营收时间（精确到月）
  test('项目信息：get_project_info 返回 plan_income_date（预估营收月份） @project_detail', async ({ request }) => {
    // 动态取任一项目 id
    const pl = await (await request.get('/manage_api/project/get_project_list?page=1&limit=5', { headers })).json();
    const proj = listOf(pl.data)[0];
    test.skip(!proj, '无可用项目样本');
    const pid = proj.id || proj.project_id;
    const info = await (await request.get(`/manage_api/project/get_project_info?id=${pid}`, { headers })).json();
    expect(info.code).toBe(0);
    expect(info.data.info, 'get_project_info 应含 info 对象').toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(info.data.info, 'plan_income_date'), '应含预估营收时间字段 plan_income_date').toBe(true);
    // plan_income_date 若有值应为 YYYY-MM（精确到月）
    const v = info.data.info.plan_income_date;
    if (v) expect(String(v)).toMatch(/^\d{4}-\d{2}$/);
  });

  test('项目信息：不存在的 project id 不 5xx @project_detail', async ({ request }) => {
    const r = await request.get('/manage_api/project/get_project_info?id=99999999', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // item7/8 递交排期日历：数据源
  test('我的递交排期：get_publish_panel 正常响应 @project_publish', async ({ request }) => {
    const r = await request.get('/manage_api/main_panel/get_publish_panel', { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j.code).toBe(0);
  });
});
