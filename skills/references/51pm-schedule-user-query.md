# 51PM 排期页 — 按用户查一周排期（Vue 直写，实测跑通 2026-07）

比 `fill_today_timesheet.md` 的 DOM 下拉路径更稳的做法：**完全绕开下拉 UI，直接写排期页 vm 的 form**。适用于"查某人本周/某段时间排期"。

> ⚠️ 本文件是临时落点。下次做 51PM 任务时，把内容合并进
> `~/Developer/browser-harness/agent-workspace/domain-skills/51pm/fill_today_timesheet.md`
> （curator 会话只有 skill_manage，写不了 domain-skills 目录）。

## 1. 取排期页 vm（判别字段用 `"user_id" in form`）

```js
let v = document.querySelector("form.el-form").__vue__;
while (v && !(v.$data && v.$data.form && "user_id" in v.$data.form)) v = v.$parent;
```

form 字段：`limit(999) page user_id:[] dept_id:[] hire_type:"" start_date end_date`。
**默认日期就是当前周**（周一~周日），查"本周"时不用改日期。

## 2. 姓名 → user_id：查 `vue.userList`

vm.$data.userList 每项：`{id, aes_id, nick_name, mobile_phone, dept_name, dept_id, hire_type}`。
按 `nick_name` 精确/包含匹配拿 `id`（例：邓欣羽 → 475）。不要硬编码 id，每次动态查。

## 3. 设 form + 点「查询」

```js
v.form.user_id = [475];   // 数组！单人也要 [id]
v.form.dept_id = [];      // 按人查时清空部门，避免残留过滤
v.form.page = 1;
```

**排期页 vm 没有 `search()`**（与任务页不同），必须点顶部「查询」按钮：
按 `textContent === "查询" && rect.y < 200` 找按钮，`click_at_xy` 中心，然后 sleep ~3s。

## 4. 整周提取（逐日 × 逐任务）

思路：遍历所有 `th.date-col` 表头，把目标行内 `.task-item` 按"中心 x 落在该列 rect 内"归到对应日期。

```js
const dedup = s => { s = s.trim(); return (s.length>1 && s.slice(0,s.length/2)===s.slice(s.length/2)) ? s.slice(0,s.length/2) : s; };
const row = Array.from(document.querySelectorAll(".person-name"))
  .find(el => el.textContent.trim().includes(NAME)).closest("tr");
for (const th of document.querySelectorAll("th.date-col")) {
  const cr = th.getBoundingClientRect();
  const items = Array.from(row.querySelectorAll(".task-item")).filter(el => {
    const r = el.getBoundingClientRect(); const cx = r.x + r.width/2;
    return cx >= cr.x && cx <= cr.x + cr.width;
  });
  // 每个 item 读 .task-name-text / .task-header(状态) / .task-meta-desc / .task-project-name
  // task-non-project class = 非项目任务(NPT)
}
```

所有 textContent 必须过 `dedup`（tooltip 副本会把文字拼两份）。

## 陷阱汇总

- `list_tabs()` 每项的 key 是 **`target_id`/`targetId`，没有 `"id"`** — 老模板 `candidates[0]["id"]` 会 KeyError（domain README 已修）。
- 跨天任务段（如 `16H` 跨两天）在每一天各出现一个 `.task-item`，汇报时按 desc 相同识别为同一段，别当成两个任务。
- 状态文本从 `.task-header` 里去掉 `.task-name-text` 部分后取（已完成/进行中/搁起）。
