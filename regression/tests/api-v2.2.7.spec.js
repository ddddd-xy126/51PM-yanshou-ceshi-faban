// V2.2.7 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-16 验收轮的接口层验证；登录态 token 从 storageState 的 localStorage 读取。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
const FEEDBACK_PACKAGE_ID = 24; // 皖江江南建筑模型发包（V2.2.7 验收反馈数据所在）
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

test.describe('V2.2.7 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  test('反馈列表：合法发包 id 返回 V2.2.7 验收数据及状态字段', async ({ request }) => {
    const res = await request.get(
      `/manage_api/outsource_feedback/get_feedback_list?outsource_package_id=${FEEDBACK_PACKAGE_ID}&page=1&limit=999`,
      { headers }
    );
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.code).toBe(0);
    const raw = JSON.stringify(j.data);
    expect(raw, '测试数据缺失：发包#24 应有 V2.2.7 验收反馈（被清理需重建）').toContain('V2.2.7验收-反馈1');
    // 驳回理由落 remark 字段
    expect(raw).toContain('V2.2.7验收-驳回测试');
  });

  test('已知BUG跟踪：反馈列表 outsource_package_id 不校验会返全库（人工确认表 #1）', async ({ request }) => {
    // 非法/缺省参数不应返回其它发包的数据；当前后端未校验 → 返全量。
    // test.fail：后端修复参数校验后本用例 unexpected pass，删标记转常规断言。
    test.fail(true, 'V2.2.7 验收发现：outsource_package_id 传 abc/缺省返回全库反馈，后端缺参数校验');
    for (const q of ['outsource_package_id=abc', '']) {
      const res = await request.get(`/manage_api/outsource_feedback/get_feedback_list?${q}&page=1&limit=5`, { headers });
      const j = await res.json();
      expect(j.data.total, `非法参数不应返回全库数据：${q}`).toBeLessThanOrEqual(50);
    }
  });

  test('已知BUG跟踪：更新反馈状态对不存在 id 返回成功（人工确认表 #2）', async ({ request }) => {
    test.fail(true, 'V2.2.7 验收发现：update_feedback_status 对 id=999999 返回 code 0，后端缺存在性校验');
    const res = await request.post('/manage_api/outsource_feedback/update_feedback_status', {
      headers,
      form: { id: 999999, quality_status: 3 },
    });
    const j = await res.json();
    expect(j.code, '不存在的反馈 id 应报错而非成功').not.toBe(0);
  });

  test('更新反馈状态：非法状态值有校验', async ({ request }) => {
    const res = await request.post('/manage_api/outsource_feedback/update_feedback_status', {
      headers,
      form: { id: 522, quality_status: 99 },
    });
    expect(res.status()).toBeLessThan(500);
    const j = await res.json();
    expect(j.code).toBe(51); // 状态值无效
  });

  test('需求任务列表：离职人员 id 保留 + 边界参数不 5xx', async ({ request }) => {
    // 正常：需求 #47294 的任务 assigned_to 含已离职的 463（林智威）
    const res = await request.get('/manage_api/project_task/get_task_list_by_demand_id?demand_id=47294&limit=60&page=1', { headers });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.code).toBe(0);
    const assigned = (j.data.data || []).map((t) => String(t.assigned_to));
    expect(assigned, '测试数据缺失：需求#47294 应有指派给离职人员 #463 的任务').toContain('463');
    // 边界：非法/不存在 demand_id 不 5xx；空参有明确报错
    for (const q of ['demand_id=abc', 'demand_id=99999999']) {
      const r2 = await request.get(`/manage_api/project_task/get_task_list_by_demand_id?${q}&limit=10&page=1`, { headers });
      expect(r2.status(), `边界参数不应 5xx：${q}`).toBeLessThan(500);
    }
    const r3 = await request.get('/manage_api/project_task/get_task_list_by_demand_id?demand_id=&limit=10&page=1', { headers });
    expect((await r3.json()).code).toBe(51); // 请选择需求
  });

  test('用户列表：在职/全量口径可区分（离职识别依据）', async ({ request }) => {
    const act = await (await request.get('/manage_api/user/get_user_select_list?limit=9999&page=1', { headers })).json();
    const all = await (await request.get('/manage_api/user/get_user_select_list?limit=9999&page=1&get_all=true', { headers })).json();
    expect(act.code).toBe(0);
    expect(all.code).toBe(0);
    expect(all.data.data.length, '全量用户应多于在职用户（含离职）').toBeGreaterThan(act.data.data.length);
    // 离职样本 #463 林智威：在全量、不在在职
    const actIds = new Set(act.data.data.map((u) => u.id));
    const allIds = new Set(all.data.data.map((u) => u.id));
    expect(allIds.has(463), '#463 应在全量列表').toBe(true);
    expect(actIds.has(463), '#463 已离职不应在在职列表').toBe(false);
  });
});
