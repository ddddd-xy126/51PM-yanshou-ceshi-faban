// V2.2.6 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-15 验收轮的接口层验证；登录态 token 从 storageState 的 localStorage 读取。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

test.describe('V2.2.6 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    headers = { Authorization: `Bearer ${getToken()}` };
  });

  test('产能人员项目列表：正常参数返回结构完整', async ({ request }) => {
    const res = await request.get(
      '/manage_api/data_export/get_employee_project_list?limit=10&page=1&dept_id[]=58&start_date=2026-07-13&end_date=2026-07-19&filter_type=all',
      { headers }
    );
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.code).toBe(0);
    expect(j.data).toHaveProperty('table_data');
  });

  test('产能人员项目列表：非法日期/越权部门不报 500', async ({ request }) => {
    for (const q of [
      'limit=10&page=1&dept_id[]=58&start_date=bad&end_date=xxx&filter_type=all',
      'limit=10&page=1&dept_id[]=999999&start_date=2026-07-13&end_date=2026-07-19&filter_type=all',
    ]) {
      const res = await request.get(`/manage_api/data_export/get_employee_project_list?${q}`, { headers });
      expect(res.status(), `边界参数不应 5xx：${q}`).toBeLessThan(500);
    }
  });

  test('会议动态列表：返回待办含负责人字段', async ({ request }) => {
    const res = await request.get('/manage_api/project_moment/get_list?project_id=6712&type=1', { headers });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.code).toBe(0);
    const raw = JSON.stringify(j.data);
    expect(raw, '#6712 会议动态数据缺失（被清理需重建）').toContain('验证待办负责人字段落库');
    expect(raw).toContain('邓欣羽'); // 待办负责人已落库
  });

  test('递交列表接口：空参/非法 project_id 不报 500（已知：project_id GET 参数疑似不过滤，人工确认表 #4）', async ({ request }) => {
    for (const q of ['project_id=99999999', 'project_id=', '']) {
      const res = await request.get(`/manage_api/project_publish/get_list?${q}`, { headers });
      expect(res.status(), `边界参数不应 5xx：${q}`).toBeLessThan(500);
    }
  });
});
