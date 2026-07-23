// V2.2.8 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-07-16 验收轮的接口层验证；登录态 token 从 storageState 的 localStorage 读取。
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
function getToken() {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../auth/state.json'), 'utf8'));
  const origin = state.origins.find((o) => o.origin.includes('10.67.8.183'));
  return origin.localStorage.find((l) => l.name === 'oauthToken').value;
}

test.describe('V2.2.8 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    const t = getToken();
    headers = { Authorization: t, token: t };
  });

  const PUBLISH_LIST =
    '/manage_api/project_publish/get_list?begin=2026-01-01 00:00:00&end=2026-12-31 23:59:59&limit=20&page=1&is_increment_pack=-1&is_over_tb_time=';

  test('超时递交筛选：is_over_tb_time=1 为全量的真子集 @project_publish', async ({ request }) => {
    const all = await (await request.get(encodeURI(PUBLISH_LIST + '-1'), { headers })).json();
    const over = await (await request.get(encodeURI(PUBLISH_LIST + '1'), { headers })).json();
    expect(all.code).toBe(0);
    expect(over.code).toBe(0);
    expect(over.data.total).toBeGreaterThan(0);
    expect(over.data.total).toBeLessThan(all.data.total);
  });

  test('已知问题跟踪：is_over_tb_time 非法枚举不校验（人工确认表 #2） @project_publish', async ({ request }) => {
    // V2.2.8 验收发现：abc → 返回介于全量与超时集之间的 403 条，后端未校验。
    // test.fail：后端补校验（报 code 51 或按默认全量处理）后 unexpected pass，删标记转常规断言。
    test.fail(true, 'V2.2.8 验收发现：is_over_tb_time=abc 返回非全量非超时集的数据，后端缺参数校验');
    const bad = await (await request.get(encodeURI(PUBLISH_LIST + 'abc'), { headers })).json();
    const all = await (await request.get(encodeURI(PUBLISH_LIST + '-1'), { headers })).json();
    expect(bad.code === 51 || bad.data.total === all.data.total, '非法枚举应报错或按默认处理').toBe(true);
  });

  test('人员看板：type=pm/dta/tech 正常、非法 type 优雅报错 @data_export', async ({ request }) => {
    for (const type of ['pm', 'dta', 'tech']) {
      const j = await (
        await request.get(`/manage_api/data_export/get_user_project?start_year=2025&end_year=2026&ecp_kaigong_zhuangtai=&type=${type}`, { headers })
      ).json();
      expect(j.code, `type=${type} 应 code 0`).toBe(0);
    }
    for (const type of ['bad_type', '']) {
      const r = await request.get(`/manage_api/data_export/get_user_project?start_year=2025&end_year=2026&type=${type}`, { headers });
      expect(r.status(), `type=${type} 不应 5xx`).toBeLessThan(500);
      const j = await r.json();
      expect(j.code, `type=${type} 应报参数错误 code 51`).toBe(51);
    }
  });

  test('递交常量：WDPAPI 枚举含 API2.3.x @project_publish', async ({ request }) => {
    const j = await (await request.get('/manage_api/project_publish/get_normal_const', { headers })).json();
    expect(j.code).toBe(0);
    expect(JSON.stringify(j.data)).toContain('API2.3.x');
  });

  test('需求状态枚举：#6690 存在自动暂停的 pause 需求 @demand', async ({ request }) => {
    const j = await (
      await request.get('/manage_api/demand/get_project_demand_list?project_id=6690&limit=100&page=1', { headers })
    ).json();
    expect(j.code).toBe(0);
    const arr = j.data?.data || [];
    expect(arr.length).toBeGreaterThan(0);
    const paused = arr.filter((d) => d.status === 'pause');
    expect(
      paused.length,
      '测试数据缺失：#6690 应有自动转 pause 的需求（失效时扫其他项目重找 status=pause 样本）'
    ).toBeGreaterThan(0);
  });

  test('模型看板总览：发包/金额汇总自洽 @outsource', async ({ request }) => {
    const j = await (
      await request.get('/manage_api/outsource/get_data_overview?period=month&producer_scope=all&score_scope=all', { headers })
    ).json();
    expect(j.code).toBe(0);
    const o = j.data.data.overview;
    expect(o.package_total).toBe(o.supplier_package_count + o.self_made_package_count);
    expect(Math.round(o.package_amount_total)).toBe(Math.round(o.supplier_package_amount + o.self_made_package_amount));
    expect(o.asset_total).toBeGreaterThan(0);
  });

  test('模型看板明细：非法筛选参数不 5xx @outsource', async ({ request }) => {
    const cases = [
      '/manage_api/outsource/get_data_overview?period=abc&producer_scope=all&score_scope=all',
      '/manage_api/outsource/get_data_overview',
      '/manage_api/outsource/get_package_dimension_list?page=1&limit=10&is_self_made=-1&status=abc',
    ];
    for (const url of cases) {
      const r = await request.get(url, { headers });
      expect(r.status(), `${url} 不应 5xx`).toBeLessThan(500);
    }
  });

  test('已知BUG跟踪：资产明细负数 limit 触发 500（人工确认表 #6） @outsource', async ({ request }) => {
    // V2.2.8 验收发现：limit=-5 → HTTP 500 slice bounds out of range，后端未校验负数分页。
    // test.fail：后端修复后 unexpected pass，删标记转常规断言。
    test.fail(true, 'V2.2.8 验收发现：get_asset_dimension_list limit=-5 返回 500 slice panic');
    const r = await request.get(
      '/manage_api/outsource/get_asset_dimension_list?page=1&limit=-5&is_self_made=-1&package_status=-1&task_status=-1',
      { headers }
    );
    expect(r.status(), '负数 limit 不应 500').toBeLessThan(500);
  });
});
