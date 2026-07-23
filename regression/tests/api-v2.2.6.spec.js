// V2.2.6 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-15 验收轮的接口层验证；登录态 token 从 storageState 的 localStorage 读取。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ensureMeetingMoment, CURRENT_USER } = require('./helpers');

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

  test('产能人员项目列表：正常参数返回结构完整 @data_export', async ({ request }) => {
    const res = await request.get(
      '/manage_api/data_export/get_employee_project_list?limit=10&page=1&dept_id[]=58&start_date=2026-07-13&end_date=2026-07-19&filter_type=all',
      { headers }
    );
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.code).toBe(0);
    expect(j.data).toHaveProperty('table_data');
  });

  test('产能人员项目列表：非法日期/越权部门不报 500 @data_export', async ({ request }) => {
    for (const q of [
      'limit=10&page=1&dept_id[]=58&start_date=bad&end_date=xxx&filter_type=all',
      'limit=10&page=1&dept_id[]=999999&start_date=2026-07-13&end_date=2026-07-19&filter_type=all',
    ]) {
      const res = await request.get(`/manage_api/data_export/get_employee_project_list?${q}`, { headers });
      expect(res.status(), `边界参数不应 5xx：${q}`).toBeLessThan(500);
    }
  });

  test('会议动态列表：待办负责人字段落库（动作型自造真验） @project_moment', async ({ request }) => {
    // 不依赖测试库残留数据：幂等造数——首轮按接口建一条带待办负责人的会议动态，
    // 之后各轮命中同 marker 复用（不重复建、不堆垃圾数据），库被刷新也照样真跑（不 skip）。
    // 项目用 6644（贵州茅台，稳定存在）。
    const marker = 'V2.2.6回归-会议动态-待办负责人字段落库';
    const { item } = await ensureMeetingMoment(request, { projectId: 6644, marker });

    // 校验机制而非某条残留数据：命中的会议动态其待办里含负责人（userIds/userNames）
    expect(item.content).toContain(marker);
    const todos = JSON.parse(item.remark || '[]');
    expect(Array.isArray(todos) && todos.length > 0, '会议动态应含待办事项').toBeTruthy();
    const withOwner = todos.find(
      (t) => Array.isArray(t.userIds) && t.userIds.includes(CURRENT_USER.id)
    );
    expect(withOwner, '待办应落库负责人 userIds').toBeTruthy();
    expect(withOwner.userNames, '待办负责人 userNames 应含姓名').toContain(CURRENT_USER.name);
  });

  test('递交列表接口：空参/非法 project_id 不报 500（已知：project_id GET 参数疑似不过滤，人工确认表 #4） @project_publish', async ({ request }) => {
    for (const q of ['project_id=99999999', 'project_id=', '']) {
      const res = await request.get(`/manage_api/project_publish/get_list?${q}`, { headers });
      expect(res.status(), `边界参数不应 5xx：${q}`).toBeLessThan(500);
    }
  });
});
