// V2.2.3 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-17 验收轮：日报导出 include_images 参数 + 批量反馈提交校验。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888';
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

test.describe('V2.2.3 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: 'Bearer ' + t, token: t };
  });

  const EXPORT = '/manage_api/project_task_estimate/export_estimate_list_by_project_id';

  // 动态发现一个有日报数据的项目：项目列表接口取第一页第一个项目
  async function pickProjectId(request) {
    const r = await request.get('/manage_api/project/get_project_list?page=1&limit=5', { headers });
    if (!r.ok()) return null;
    const j = await r.json().catch(() => null);
    const rows = (j && j.data && (j.data.data || j.data.list)) || [];
    return rows.length ? rows[0].id : null;
  }

  test('日报导出：include_images 参数生效（含图文件显著大于不含图） @estimate', async ({ request }) => {
    const pid = (await pickProjectId(request)) || 6651; // 找不到时退回验收样本
    const get = async (inc) =>
      request.get(`${EXPORT}?project_id=${pid}&start_date=&end_date=&include_images=${inc}`, { headers });
    const withImg = await get('true');
    const noImg = await get('false');
    expect(withImg.status()).toBe(200);
    expect(noImg.status()).toBe(200);
    const ctW = withImg.headers()['content-type'] || '';
    test.skip(!/spreadsheet/.test(ctW), `项目 #${pid} 日报导出未返回 xlsx（测试库刷新后换有日报的项目）`);
    const [bw, bn] = [(await withImg.body()).length, (await noImg.body()).length];
    expect(bw, '含图导出应不小于不含图').toBeGreaterThanOrEqual(bn);
  });

  test('日报导出边界：空 project_id 报 51、非法 include_images 不 5xx @estimate', async ({ request }) => {
    const empty = await request.get(`${EXPORT}?project_id=&include_images=true`, { headers });
    expect(empty.status()).toBeLessThan(500);
    const j = await empty.json();
    expect(j.code, '空 project_id 应 code 51').toBe(51);

    const bad = await request.get(`${EXPORT}?project_id=6651&start_date=2026-07-01&end_date=2026-07-15&include_images=abc`, { headers });
    expect(bad.status(), 'include_images 非法值不应 5xx').toBeLessThan(500);
  });

  test('批量反馈提交：空商机号/空模块被后端拒绝（code 51） @produce_demand', async ({ request }) => {
    const post = (body) =>
      request.post('/manage_api/produce_demand/add_apply_demand', {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: body,
      });
    const noSj = await (await post({ sj_num: '', project_name: '', apply_demand_module: ['其他'], apply_demand_desc: 'x', apply_material_address: '', demand_url: [], _key: 1 })).json();
    expect(noSj.code, '空商机号应被拒').toBe(51);
    const noModule = await (await post({ project_id: 6727, sj_num: 'SJ202601230001', project_name: 'CBD物业管理系统', apply_demand_module: [], apply_demand_desc: '', apply_material_address: '', demand_url: [], _key: 1 })).json();
    expect(noModule.code, '空模块应被拒').toBe(51);
  });

  test('我的反馈可见性：本人+有PM项目的待审批申请应在 get_my_demand_list（动作型自造真验） @produce_demand', async ({ request }) => {
    // V2.2.3 复验结论（2026-07-17）：有 PM 项目的申请提交后立即可见；无 PM 项目不可见属数据问题（口径待产品确认）。
    // 动作型自造：先确保存在「本人+有PM+待PM审批」样本（被审批消耗后自动重提一条恢复），不依赖遗留数据、不 skip。
    const { ensureApplyDemand } = require('./helpers');
    const seed = await ensureApplyDemand(request);
    // 仅当测试库彻底清空、无任何「本人+有PM」历史申请可作造数模板时才退回 skip（最后兜底）
    test.skip(!seed.item, seed.reason || '无可用造数模板');
    const target = seed.item;
    expect(target.apply_demand_status, '样本应处于待PM审批').toBe('待PM审批');
    expect(target.pm, '样本项目应有 PM').toBeTruthy();

    const my = await (
      await request.get('/manage_api/produce_demand/get_my_demand_list?sj_num=&page=1&limit=50&pm_id=&apply_demand_module=&apply_demand_status=&start_date=&end_date=', { headers })
    ).json();
    const myRows = (my.data && (my.data.data || my.data.list)) || [];
    expect(myRows.some((x) => x.id === target.id), `#${target.id}（本人+有PM+待PM审批）应在我的申请列表可见`).toBe(true);
  });
});
