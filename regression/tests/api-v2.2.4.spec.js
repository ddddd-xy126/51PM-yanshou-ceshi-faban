// V2.2.4 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07 V2.2.4 追溯验收轮；登录态 token 从 storageState 的 localStorage 读取。
// 覆盖：任务选项新增项 / 非项目需求作用域字段 / 模型数据看板汇总自洽 / 两条明细的健壮性差异（B1）。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

const NOT_PROJECT_ID = 6839; // 非项目（get_demand_list 样本）

test.describe('V2.2.4 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  test('任务选项：项目场景-其它 新增「项目资源迁移(545)/项目资源导出(546)」', async ({ request }) => {
    const j = await (await request.get('/manage_api/index/get_task_options', { headers })).json();
    expect(j.code).toBe(0);
    // 结构：data.data[]{dept_name, task_options[]{label, id, children[]{label,id}}}
    const flat = JSON.stringify(j.data);
    // 标签 + 选项 ID 均在返回中（ID 可能以数字或字符串形态出现，用宽松匹配）
    const hasId = (id) => new RegExp(`\\b${id}\\b`).test(flat);
    expect(flat, '应含 项目资源迁移').toContain('项目资源迁移');
    expect(flat, '应含 项目资源导出').toContain('项目资源导出');
    expect(hasId(545), '应含选项 ID 545').toBe(true);
    expect(hasId(546), '应含选项 ID 546').toBe(true);
  });

  test('非项目任务：get_demand_list 返回需求层级字段（pid/p_level）供作用域约束', async ({ request }) => {
    const j = await (
      await request.get(
        `/manage_api/project_not_task/get_demand_list?project_id=${NOT_PROJECT_ID}&limit=20&page=1`,
        { headers }
      )
    ).json();
    expect(j.code).toBe(0);
    const arr = j.data?.data || j.data || [];
    expect(Array.isArray(arr) ? arr.length : 0, '非项目应有需求样本').toBeGreaterThan(0);
    const sample = (Array.isArray(arr) ? arr : [])[0];
    // pid / p_level 是「仅子需求下创建任务」作用域约束的数据基础
    expect(sample).toHaveProperty('pid');
  });

  test('模型看板总览：发包/金额/资产汇总自洽', async ({ request }) => {
    const j = await (
      await request.get('/manage_api/outsource/get_data_overview?period=month&producer_scope=all&score_scope=all', {
        headers,
      })
    ).json();
    expect(j.code).toBe(0);
    const o = j.data.data.overview;
    expect(o.package_total, '发包总数=供应商+自制').toBe(o.supplier_package_count + o.self_made_package_count);
    expect(Math.round(o.package_amount_total), '发包金额=供应商+自制').toBe(
      Math.round(o.supplier_package_amount + o.self_made_package_amount)
    );
    expect(o.asset_total, '资产总数>0').toBeGreaterThan(0);
  });

  test('模型明细：项目维度与资产维度均返回、与总览发包数自洽', async ({ request }) => {
    const overview = await (
      await request.get('/manage_api/outsource/get_data_overview?period=month&producer_scope=all&score_scope=all', {
        headers,
      })
    ).json();
    const pkg = await (
      await request.get('/manage_api/outsource/get_package_dimension_list?page=1&limit=10&is_self_made=-1&status=-1', {
        headers,
      })
    ).json();
    const asset = await (
      await request.get(
        '/manage_api/outsource/get_asset_dimension_list?page=1&limit=10&is_self_made=-1&package_status=-1&task_status=-1',
        { headers }
      )
    ).json();
    expect(pkg.code).toBe(0);
    expect(asset.code).toBe(0);
    // 项目维度总条数 == 总览发包总数（同一口径）
    const pkgTotal = pkg.data?.total ?? pkg.data?.data?.total;
    expect(pkgTotal, '项目维度总数应=总览发包总数').toBe(overview.data.data.overview.package_total);
  });

  test('模型看板：非法筛选参数不 5xx（总览与明细）', async ({ request }) => {
    const cases = [
      '/manage_api/outsource/get_data_overview?period=xxx&producer_scope=all&score_scope=all',
      '/manage_api/outsource/get_data_overview',
      '/manage_api/outsource/get_package_dimension_list?page=1&limit=10&is_self_made=-1&status=abc',
    ];
    for (const url of cases) {
      const r = await request.get(url, { headers });
      expect(r.status(), `${url} 不应 5xx`).toBeLessThan(500);
    }
  });

  test('发包明细：负数 limit 有参数校验（code 52）', async ({ request }) => {
    const j = await (
      await request.get('/manage_api/outsource/get_package_dimension_list?page=1&limit=-5&is_self_made=-1&status=-1', {
        headers,
      })
    ).json();
    // 发包明细对负数分页优雅校验（与资产明细缺校验形成对照，见下一条 B1）
    expect(j.code, '负数 limit 应报参数错误 code 52').toBe(52);
  });

  test('已知缺陷跟踪 B1：资产明细负数 limit 触发 500（发包明细同参却校验）', async ({ request }) => {
    // V2.2.4 验收发现：get_asset_dimension_list limit=-5 → HTTP 500 slice panic；
    // 同版 get_package_dimension_list 同参报 code 52。校验不一致的健壮性缺陷（UI 不会触发，仅构造参数）。
    // test.fail：后端补负数分页校验后 unexpected pass，删标记转常规断言。
    test.fail(true, 'V2.2.4 验收发现：get_asset_dimension_list limit=-5 返回 500 slice panic');
    const r = await request.get(
      '/manage_api/outsource/get_asset_dimension_list?page=1&limit=-5&is_self_made=-1&package_status=-1&task_status=-1',
      { headers }
    );
    expect(r.status(), '负数 limit 不应 500').toBeLessThan(500);
  });
});
