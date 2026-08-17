# AI自动填充项目动态（飞书会议纪要）【写】

> 一句话：在项目动态"添加会议动态"里，把**飞书**智能会议纪要原文整段粘贴，点「开始 AI 识别」由 AI 自动解析会议类型/会议内容/参会人员/待办事项并回填表单，核对后提交；识别以 agent 异步任务进行，右下角「Agent 任务进程」面板看状态。V2.3.2 新增（AI 赋能，仅支持飞书纪要）。

- **入口**：项目 → 项目动态 → 「添加动态」→「会议动态」tab →「AI 自动填充」
- **路由**：`/project/project_moment?projectId=N`
- **适用/触发**：把飞书会议智能纪要一键转成结构化会议动态，免手工誊抄

## 参数

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `projectId` | `6679` | 目标项目（页面「切换项目」或 URL 携带） |
| `raw_text` | 飞书会议纪要原文 | 含会议主题/时间/参会人/# 总结/# 待办 段落 |
| `intent` | `moment_meeting_ai_fill` | ai_skill/execute 的意图标识 |

## 操作步骤（真实 UI）

1. 导航到 `/project/project_moment?projectId=N`（或先选「切换项目」）
2. 点「添加动态」→ 弹窗默认「会议动态」tab（另有 风险/问题动态 tab）
3. 点「AI 自动填充」→ AI 子弹窗，textarea「在此粘贴会议纪要原文……」（内容自动存草稿）
4. 粘贴飞书会议智能纪要原文 →「开始 AI 识别」
5. 识别转**异步 agent 任务**：右下角「Agent 任务进程」出现计数徽章，点开「51PM Agent」面板见任务「会议纪要填充」的状态（进行中/成功/失败）+ 耗时 + 重试/跳转来源/完成
6. 成功后 AI 回填 会议类型/会议内容/参会人员（按系统账号昵称匹配）/待办事项 → 用户核对补正 →「提交」写入 `project_moment`（module=meet）

```js
// 打开添加动态 → AI 自动填充
[...document.querySelectorAll('button')].find(b => /添加动态/.test(b.innerText)).click();
const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => getComputedStyle(d.closest('.el-dialog__wrapper')||d).display!=='none').pop();
[...dlg.querySelectorAll('button')].find(b => b.innerText.trim() === 'AI 自动填充').click();
// 粘贴 + 开始识别
const ai = [...document.querySelectorAll('.el-dialog')].find(d => /AI 自动填充 · 会议动态/.test(d.innerText));
const ta = ai.querySelector('textarea');
const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;
setter.call(ta, FEISHU_TEXT); ta.dispatchEvent(new Event('input',{bubbles:true}));
[...ai.querySelectorAll('button')].find(b => /开始 AI 识别/.test(b.innerText)).click();
```

## 可直调接口

- `GET /manage_api/ai_api_key/get_ai_api_key_status` → `{configured, default_model}`（需先在「我的工作台-51PM Agent配置」配置生效的 AI Key）
- `POST /manage_api/ai_skill/execute` body `{intent:"moment_meeting_ai_fill", slots:{raw_text}}` → `{code, data:{session_id, status, intent, slots, result, reply}}`；`status` 常见 ready（识别成功，result/slots 为回填字段）/`llm_error`（模型异常，reply 为错误文案）
- 提交会议动态复用 `POST /manage_api/project_moment/add`（module=meet）

## 已知坑

- ⚠️ **仅支持飞书智能纪要**格式（会议主题/时间/参会人/# 总结/# 待办）；其它来源识别效果无保证
- ⚠️ 模型服务限流时 `ai_skill/execute` 返 `code:0` 但 `data.status:"llm_error"` + reply「模型服务请求过于频繁（429），请稍后再试或更换模型」——**HTTP 200 不等于识别成功，必须看 `data.status`**；51PM Agent 面板对应任务显「失败」，可「重试」或到「51PM Agent配置」换模型
- ⚠️ 2026-08-17 验收时 deepseek-v3 持续 429，真实回填结果未实测；自动化验证 AI 回填质量需在模型配额充足时段做，哨兵用例只守接口契约（不 5xx + 返 `data.status`），别死等 LLM 成功
- ⚠️ 识别是异步任务（agent 任务进程），点「开始 AI 识别」后不阻塞，结果回填有延迟，别立刻断言表单已填

---
_来源：V2.3.2 验收轮 ｜ 最后验证：2026-08-17_
