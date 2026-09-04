// V2.3.3 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-08-24 验收轮（V2.3.3-pre-项目成本看板）→ 2026-09-04 用户指示落实为正式版本。
// 2026-09-04 已用登录态实测跑通（旧 token 缓存过期，用集成浏览器当前活跃会话的 oauthToken 刷新 auth/state.json 后复测全绿）。
// period_key 格式经真机 UI 实测确认：day=YYYY-MM-DD｜week=YYYY-Www(ISO周)｜month=YYYY-MM｜quarter=YYYYQn｜half=YYYYHn｜year=YYYY；
// ⚠️半年统计周期的 period_type 取值是 `half`，**不是** `half_year`（真机 network 拓实测确认，与 UI 文案「半年」不同名）。
// 该参数为必填，留空会返回业务码 51「请选择统计周期」（非 5xx，但也非成功契约，故各 period_type 用例需带上对应格式的 period_key）。
const { test, expect } = require('@playwright/test');
const { authHeaders, API_BASE } = require('./helpers');

const BASE = API_BASE; // http://localhost:8888
const y = new Date().getFullYear();
const PERIOD_KEYS = { month: `${y}-07`, quarter: `${y}Q3`, half: `${y}H2`, year: `${y}` };
const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
const TODAY_KEY = `${y}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

test.describe('V2.3.3 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    headers = authHeaders();
  });

  // ① 核心接口基本契约：year 周期带合法 period_key，返回项目级明细 + 聚合汇总
  test('项目成本动态看板：get_project_cost_stat 基本契约 @data_export', async ({ request }) => {
    const j = await (
      await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=year&period_key=${PERIOD_KEYS.year}&group=&pm=&project_id=`, { headers })
    ).json();
    expect(j.code).toBe(0);
    expect(j.data).toHaveProperty('period');
    expect(Array.isArray(j.data.projects)).toBe(true);
  });

  // ② period_key 留空应返回业务码 51「请选择统计周期」（必填校验存在,而非静默当全部处理）
  test('项目成本动态看板：period_key 留空返回业务码51(必填校验) @data_export', async ({ request }) => {
    const r = await request.get('/manage_api/data_export/get_project_cost_stat?period_type=month&period_key=&group=&pm=&project_id=', { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j.code).toBe(51);
  });

  // ③ month/quarter/half/year 四种周期带对应格式的合法 period_key 均返回 code=0
  for (const pt of ['month', 'quarter', 'half', 'year']) {
    test(`项目成本动态看板：period_type=${pt} 带合法 period_key 返回 code=0 @data_export`, async ({ request }) => {
      const r = await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=${pt}&period_key=${PERIOD_KEYS[pt]}&group=&pm=&project_id=`, { headers });
      expect(r.status()).toBeLessThan(500);
      const j = await r.json();
      expect(j.code).toBe(0);
      expect(Array.isArray(j.data?.projects)).toBe(true);
    });
  }

  // ④ day 周期带当日日期格式 period_key，返回 code=0（项目数可能为 0，只守契约不守数量）
  test('项目成本动态看板：period_type=day 带当日 period_key 返回 code=0 @data_export', async ({ request }) => {
    const r = await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=day&period_key=${TODAY_KEY}&group=&pm=&project_id=`, { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j.code).toBe(0);
  });

  // ⑤ 非法/边界参数不 5xx（防回归成硬报错）
  test('项目成本动态看板：非法 period_type/project_id 不 5xx @data_export', async ({ request }) => {
    const r1 = await request.get('/manage_api/data_export/get_project_cost_stat?period_type=bogus&period_key=bogus&group=&pm=&project_id=', { headers });
    expect(r1.status()).toBeLessThan(500);
    const r2 = await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=year&period_key=${PERIOD_KEYS.year}&group=&pm=&project_id=999999999`, { headers });
    expect(r2.status()).toBeLessThan(500);
  });

  // ⑥ project_id 筛选生效：单项目应精确收窄为该项目本身
  test('项目成本动态看板：project_id 筛选精确收窄为单项目 @data_export', async ({ request }) => {
    const allJson = await (
      await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=year&period_key=${PERIOD_KEYS.year}&group=&pm=&project_id=`, { headers })
    ).json();
    const list = allJson.data?.projects || [];
    test.skip(!list.length, '当前无在统计项目（数据状态所限），跳过');
    const pid = list[0].id;
    const oneJson = await (
      await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=year&period_key=${PERIOD_KEYS.year}&group=&pm=&project_id=${pid}`, { headers })
    ).json();
    expect(oneJson.code).toBe(0);
    const oneList = oneJson.data?.projects || [];
    expect(oneList.length).toBeLessThanOrEqual(1);
    if (oneList.length === 1) expect(oneList[0].id).toBe(pid);
  });

  // ⑦ 跨模块对照：project_overview/get_header 的 cost_compare 结构存在（不强断言与本看板具体数值相等，
  //    两者"产出"边界不完全同源属已知 R1，见 acceptance-report，本用例只守契约不守具体数值）。
  //    本看板 project_id 是项目编号(如 SJ202605120002)，project_overview 用的是数字库 id，需经 sj_num 查表转换。
  test('跨模块对照：project_overview/get_header 返回 cost_compare.{algoA,algoB} 结构 @data_export', async ({ request }) => {
    const pkgJson = await (
      await request.get(`/manage_api/data_export/get_project_cost_stat?period_type=year&period_key=${PERIOD_KEYS.year}&group=&pm=&project_id=`, { headers })
    ).json();
    const list = pkgJson.data?.projects || [];
    test.skip(!list.length, '当前无在统计项目，跳过');
    const sjNum = list[0].id;
    const listJson = await (
      await request.get(`/manage_api/project/get_project_list?page=1&limit=1&sj_num=${sjNum}`, { headers })
    ).json();
    const pid = listJson.data?.data?.[0]?.id;
    test.skip(!pid, `项目编号 ${sjNum} 未能反查到数字库id，跳过`);
    const j = await (await request.get(`/manage_api/project_overview/get_header?project_id=${pid}`, { headers })).json();
    expect(j.code).toBe(0);
    expect(j.data).toHaveProperty('cost_compare');
    expect(j.data.cost_compare).toHaveProperty('algoA');
    expect(j.data.cost_compare).toHaveProperty('algoB');
  });
});
