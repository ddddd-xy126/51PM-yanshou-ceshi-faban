// V2.3.2 接口回归（纯 request，不开浏览器，秒级）
// 沉淀自 2026-08-17 验收轮：模型外包-查看日报抽屉/反馈走查留言/快捷添加反馈 + AI自动填充项目动态。
const { test, expect } = require('@playwright/test');
const { authHeaders, API_BASE, ensureFeedbackSuggestion } = require('./helpers');

const BASE = 'http://localhost:8888'; // globalSetup 起的转发
const listOf = (d) => (Array.isArray(d) ? d : d?.data || d?.list || d?.table_data || []);

test.describe('V2.3.2 接口回归', () => {
  test.use({ baseURL: BASE });
  let headers;
  test.beforeAll(() => {
    headers = authHeaders();
  });

  // ① 抽屉日报：outsource_task/get_task_list + outsource_daily_report/get_daily_report_list
  test('模型外包-日报抽屉：任务列表 + 逐任务日报列表返回结构 @outsource', async ({ request }) => {
    // 动态挑一个带日报的发包
    const pkgJson = await (await request.get('/manage_api/outsource/get_package_list?page=1&limit=50&sj_num=', { headers })).json();
    expect(pkgJson.code).toBe(0);
    const pkgs = listOf(pkgJson.data);
    const withRep = pkgs.filter((p) => Number(p.report_count) > 0).sort((a, b) => b.report_count - a.report_count);
    expect(withRep.length, '应存在带日报的发包').toBeGreaterThan(0);
    const pkg = withRep[0];

    const tkJson = await (await request.get(`/manage_api/outsource_task/get_task_list?outsource_package_id=${pkg.id}`, { headers })).json();
    expect(tkJson.code).toBe(0);
    const tasks = listOf(tkJson.data);
    expect(tasks.length).toBeGreaterThan(0);

    const repJson = await (await request.get(`/manage_api/outsource_daily_report/get_daily_report_list?outsource_task_id=${tasks[0].id}&page=1&limit=999`, { headers })).json();
    expect(repJson.code).toBe(0);
    expect(Array.isArray(listOf(repJson.data))).toBeTruthy();
  });

  test('模型外包-日报列表：非法/空 outsource_task_id 不 5xx @outsource', async ({ request }) => {
    const r1 = await request.get('/manage_api/outsource_daily_report/get_daily_report_list?outsource_task_id=abc&page=1&limit=10', { headers });
    expect(r1.status()).toBeLessThan(500);
    const r2 = await request.get('/manage_api/outsource_daily_report/get_daily_report_list?outsource_task_id=&page=1&limit=10', { headers });
    expect(r2.status()).toBeLessThan(500);
  });

  // ② 反馈走查留言：动作型自造（create_feedback_suggestion）→ 读回（get_feedback_suggestion_list）
  test('模型外包-反馈走查留言：创建并读回落库 @outsource', async ({ request }) => {
    const marker = 'V2.3.2回归-反馈走查留言自造样本';
    const { taskId, item } = await ensureFeedbackSuggestion(request, { marker });
    expect(item).toBeTruthy();
    expect(String(item.content)).toContain(marker);
    // 读回列表确认存在
    const j = await (await request.get(`/manage_api/outsource_task/get_feedback_suggestion_list?outsource_task_id=${taskId}`, { headers })).json();
    expect(j.code).toBe(0);
    expect(listOf(j.data).some((x) => String(x.content || '').includes(marker))).toBeTruthy();
  });

  test('模型外包-反馈走查留言：非法 outsource_task_id 读列表不 5xx @outsource', async ({ request }) => {
    const r = await request.get('/manage_api/outsource_task/get_feedback_suggestion_list?outsource_task_id=abc', { headers });
    expect(r.status()).toBeLessThan(500);
  });

  // ③ 验收工作台仅拉待验收（quality_status=2）——契约不 5xx
  test('模型外包-验收工作台：get_feedback_list?quality_status=2 契约 @outsource', async ({ request }) => {
    const pkgJson = await (await request.get('/manage_api/outsource/get_package_list?page=1&limit=20&sj_num=', { headers })).json();
    const pkg = listOf(pkgJson.data)[0];
    const r = await request.get(`/manage_api/outsource_feedback/get_feedback_list?outsource_package_id=${pkg.id}&quality_status=2&page=1&limit=999`, { headers });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j.code).toBe(0);
  });

  // ⑤ AI自动填充项目动态：AI Key 状态 + ai_skill/execute 契约
  test('AI自动填充：ai_api_key/get_ai_api_key_status 返 configured/default_model @project_moment', async ({ request }) => {
    const j = await (await request.get('/manage_api/ai_api_key/get_ai_api_key_status', { headers })).json();
    expect(j.code).toBe(0);
    expect(j.data).toHaveProperty('configured');
    // 已配置时应带默认模型
    if (j.data.configured) expect(typeof j.data.default_model).toBe('string');
  });

  test('AI自动填充：ai_skill/execute(intent=moment_meeting_ai_fill) 契约不 5xx @project_moment', async ({ request }) => {
    // ⚠️ 模型服务可能 429 限流（data.status:"llm_error"），此处只验后端契约不 5xx、结构完整；
    //    真实 LLM 回填质量需在模型配额充足时段人工复验（见 acceptance-report R1）。
    const r = await request.post('/manage_api/ai_skill/execute', {
      headers,
      data: { intent: 'moment_meeting_ai_fill', slots: { raw_text: '会议主题：V2.3.2回归契约探针\n参会人：@邓欣羽\n# 待办\n- 无' } },
    });
    expect(r.status()).toBeLessThan(500);
    const j = await r.json();
    expect(j).toHaveProperty('code');
    expect(j.data).toHaveProperty('status'); // ready/llm_error 等
  });
});
