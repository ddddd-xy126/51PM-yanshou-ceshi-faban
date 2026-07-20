# 51PM — 51 工程中心项目管理系统

内部项目/工时/排期/任务管理平台。Element UI (Vue) 前端。

## 站点

51PM 有两套相互独立的环境，路由完全相同：

| 环境 | host | 用途 |
|---|---|---|
| 测试 / 开发 | `http://10.67.8.183:7777` | 演练、调试、新功能验证。页面右侧有"当前为开发环境"水印。 |
| 正式 / 生产 | `http://51pm.51aes.com:771` | 真实业务数据。写操作会影响排期、工时、任务状态。 |

- **环境策略分两类**：验收 / 回归流程（见 [SKILL.md](SKILL.md)）**默认固定测试环境** `10.67.8.183:7777`，不再询问，仅用户明确说「正式环境」才切换；其余写操作类 skill（完工、填工时等）若用户没明说环境，仍需 `AskUserQuestion` 问清楚再开干，不能凭最近一次默认。
- 登录走企业微信 OAuth2.0（一键登录或扫码）。**遇到登出请暂停问用户**，不要替用户输任何凭据。
- 不要把这两个 host 写到 skill 业务逻辑外的地方（外发文档、issue、聊天截图）。

## 主模块（顶部一级菜单）

| 菜单 | 路径 | 说明 |
|---|---|---|
| 我的地盘 | `/my_board/main/main` | 个人 dashboard：今日工时、任务计数、本周递交 |
| 需求 | `/...` | 需求池 |
| 任务 | `/task_panel/project_task` | 任务列表（只读 + 筛选）。**页面内还有 `项目任务` / `非项目任务` 两个 tab，数据互不相通**：项目任务挂在项目下，非项目任务是 NPT（培训/会议/支持/答疑等）。问"所有任务"必须两个 tab 都跑。 |
| 项目 | | 项目列表 |
| 非项目 | | 非项目（NPT）任务（独立模块，与任务页 `非项目任务` tab 是不同视角，前者面向 NPT 项目本身，后者面向具体任务条目） |
| **排期** | `/schedule/schedule_table` | 工程师 × 日期的排期表，支持查看详情、修改排期、任务分段、删除任务 |
| 递交 | | 递交记录 |
| 测试 / 统计 / 组织 / 采购 / 功能展厅 / 项目展厅 | | 其它 |

## 同生态相关站点（参考）

- `http://10.67.8.183:7777/supplier_portal/...` — 51PM 供应商制作管理系统（独立模块，发包给外包供应商）
- `https://wdpapidoc.51aes.com/` — WdpApi 开发文档

## skill 索引

- [SKILL.md](SKILL.md) — ★ **验收-测试-发版全流程总控**：回归→验收→发版→沉淀四阶段调度器，收到「验收 V2.x.x + 开发内容」从这里进
- [release_acceptance.md](release_acceptance.md) — 版本验收：依开发内容走流程找 BUG、边走边截图、出验收报告供发版技能使用（**必须走真实 UI 交互，禁止 Vue 直写代替操作**）
- [release_notes.md](release_notes.md) — 发版内容撰写规范（分类判断表/强度规则/价值红黑榜；落笔前必须逐条自查）；定妆图直接引用 `acceptance/{版本}/final-*.jpg`
- [entry_map.md](entry_map.md) — **入口地图（全 skill 共享）**：实测确认的功能入口 + 坑备注 + 页面等待锚点；找入口先查这里，新确认的入口必须回填
- [playbooks/](playbooks/) — **操作库 / SOP**：每个功能「怎么从头做完一件事」的分步流程 + 可直调接口 + 读数锚点；供人/操作型 AI 复用（如定时查工时统计）。entry_map 管「在哪」，playbook 管「怎么做完」，由验收阶段 4 回填

## 操作前置规则（强制）

> 任何 51PM skill 进入站点前都要执行此段，**禁止直接 `new_tab`**。重复 `new_tab` 会让用户的 Chrome 出现一堆同样的页面。
>
> ⚠️ **工具说明**：下方 Python 伪代码（`list_tabs`/`run_js`/`new_tab`）是早期 browser-harness 环境的遗留参考；验收/回归流程实际用 VS Code Copilot 浏览器工具 + Playwright（JS），请按同样的“先找已开 tab→复用→页内导航，未命中才新开”原则操作。

### Tab 复用模板（每次进 51pm 必跑）

```python
# 1. 找已经开着的 51pm tab（同时覆盖正式 / 测试两套 host）
tabs = list_tabs(include_chrome=False)
host_keys = ("51pm.51aes.com", "10.67.8.183")  # 正式 + 测试
candidates = [t for t in tabs if any(k in (t.get("url") or "") for k in host_keys)]

if candidates:
    # 2a. 命中：复用第一个；如果当前路由不是目标路由，再页内导航
    tid = candidates[0]["target_id"]  # 注意：list_tabs 返回的 key 是 target_id / targetId，没有 "id"
    switch_tab(tid)
    target_path = "/task_panel/project_task"  # 按本次 skill 替换
    if target_path not in (candidates[0].get("url") or ""):
        run_js(f"window.location.href = '{target_path}'")
        wait_for_selector(".el-table", timeout=15)
else:
    # 2b. 未命中：才允许新开
    new_tab(f"http://51pm.51aes.com:771/task_panel/project_task")
    wait_for_selector(".el-table", timeout=20)
```

规则要点：
1. **只读类（查任务、查工时）**：默认复用，不询问用户。
2. **写操作类（完工、新建）**：复用前先做一次轻量校验（看 URL host 是否与本次 `env` 参数一致），不一致就走 2b 新开。
3. 如果用户的 Chrome 同时开着多个 51pm tab，优先选 URL 已经在目标路由的；其次选最近活跃的（`tabs` 顺序通常即活跃度顺序）。
4. **永远不要用 `goto_url` 在当前 tab 强制导航**——那会覆盖用户其它工作。

## 通用约束（写新 skill 前必读）

### ⚡ 首选：Vue data 直写（绕开 DOM 筛选 UI）

51PM 是 Vue + Element UI v2。**表单可以直接拿到 root vm 后赋值 `vue.form.*` 再调 `vue.search()`**——这是 2026-05 最稳的路径，能跳过所有 DOM 点击 / dropdown / date-picker 的陷阱。只有在 Vue 实例拿不到（极少见）时才回退 DOM 路径。

> ⚠️ **验收场景例外**：验收（[release_acceptance.md](release_acceptance.md)）**必须走真实 UI 交互**，Vue 直写只用于数据断言、不代替操作（否则把待验的交互层整个绕过去）。下述“Vue 直写首选”仅适用于查询/写操作类 skill。

**取 vm 的标准套路**：
```js
// 从 form 元素上溯到含本页业务状态的那个 vm
let v = document.querySelector("form.el-form").__vue__;
while (v && !(v.$data && v.$data.form && v.$data.statusList)) v = v.$parent;  // 任务页
while (v && !v.$data.scheduleTableList) v = v.$parent;                          // 排期页
```

**任务页 form 字段集**（`/task_panel/project_task` 与 `/task_panel/project_not_task` 同一模型）：
```
limit page status name project_id dept_id assigned_to one_type
start_date end_date date_type
```
- `status` 是英文 key：`wait/doing/done/pause/cancel/closed`（中文 label 在 `vue.statusList`中查）
- `dept_id` 标量；`vue.deptList[i] = {id, title, ...}`，`title` 是全路径串
- `one_type`: `"" / "产出" / "非产出"`
- `date_type` 默认 `"task"`

**排期页 form**（`/schedule/schedule_table`）：
```
limit page user_id:[] dept_id:[] hire_type:"" start_date end_date
```
- `dept_id` / `user_id` 是**数组**（多选），单部门也要 `[15]`
- 部门映射表在 `vue.deptFlatList`
- 该 vm 可能**没有 `search()`**，回退为点页面上的「查询」按钮

**实战查询函数**（任务页）：
```python
import json
def query_via_vue(status=None, dept_id=None, start=None, end=None,
                  one_type=None, project_id=None, assigned_to=None,
                  name=None, limit=200):
    js(f'''(() => {{
      let v = document.querySelector("form.el-form").__vue__;
      while (v && !(v.$data && v.$data.form && v.$data.statusList)) v = v.$parent;
      if (!v) return null;
      v.form.status = {json.dumps(status or "")};
      v.form.dept_id = {json.dumps(dept_id if dept_id is not None else "")};
      v.form.start_date = {json.dumps(start or "")};
      v.form.end_date = {json.dumps(end or "")};
      v.form.one_type = {json.dumps(one_type or "")};
      v.form.project_id = {json.dumps(project_id or "")};
      v.form.assigned_to = {json.dumps(assigned_to or "")};
      v.form.name = {json.dumps(name or "")};
      v.form.date_type = "task"; v.form.page = 1; v.form.limit = {limit};
      v.search && v.search();
      return true;
    }})()''')
    time.sleep(3.0)
```

**动态查 dept_id**（不要硬编码）：
```python
dept_id = js('''(() => {
  let v = document.querySelector("form.el-form").__vue__;
  while (v && !v.deptList) v = v.$parent;
  const hit = v.deptList.find(d => d.title === "Aes/工程与交付/项目交付/Web端开发");
  return hit ? hit.id : null;
})()''')
```

**为什么不走 DOM**：历史上踩过的坑——点 input 不开下拉、点中错的 input、`type_text` 误填、cascader 下拉 `getBoundingClientRect()` 返 0/0、重置后 dropdown 漂浮、status 清空但部门保留——走 Vue 直写全部消失。

### 通用约束

- **写操作必须先停下来确认**：弹窗里凡是"修改排期 / 任务分段 / 删除任务 / 提交 / 新增 / 删除 / 完工"等不可逆按钮，agent 不要自己点；列出来 + 编号 + AskUserQuestion 后再批处理。
- **任务列表里只能点操作栏第 1 个图标"完工"**（`button.finish`，icon `el-icon-document-checked`）。**禁止点**编辑 (`el-icon-edit-outline`) / 工时 (`el-icon-time`, class `workHour`) / 删除 (`el-icon-delete`)。
- **状态机**：`未开工 → 进行中 → 完成`。未开工状态下 `button.finish` 是 `is-disabled`、`disabled=true`，必须先把任务推到进行中才能点完工 — 这一步通常不归 agent 做。
- **不要写死像素坐标或随机生成的 class**。Element UI 的 `el-select__caret`、`el-input__inner`、`button.finish`、`button.workHour` 等是稳定的；popper 的 z-index 容器位置不稳。
- **el-select 下拉**：popper 渲染到 `body` 顶层，搜索框与选项不在原 select 容器里。找当前展开的那个：`Array.from(document.querySelectorAll(".el-select-dropdown")).find(el => el.style.display !== "none" && el.offsetParent)`。
- **el-date-picker 设置日期**：`input.el-input__inner` 的 `value` 字段直接 set 不会同步到 v-model。两种可靠做法：
  1. 走 Vue：`__vue__` 向上找到 `_componentTag === "el-date-picker"` 的实例，调 `$emit("input", new Date("YYYY-MM-DD"))`。
  2. 用 UI：点开日期面板逐个点日期格子。
  设置完后用 `查询` 按钮的接口刷新；input 显示出 `2026 年 04 月 27 日` 这种 zh-CN 格式说明确实生效了。
- **行内右键/单击菜单（排期表）**：单击 `.task-item` 会在右侧弹一个 portal 菜单 `.menu-item`（`查看详情 / 修改排期 / 任务分段 / 删除任务`）。再次点击其它地方关闭。
- **详情弹窗** `.el-dialog.task-detail-dialog` 按 `Escape` 关闭最稳。
- **el-table 单元格文字看起来"重复"**：`<td>` 里有 cell 文字 + 鼠标悬停的 tooltip 副本，`textContent` 里会拼成两份。统一过滤：`s.length>1 && s.slice(0,s.length/2) === s.slice(s.length/2) ? s.slice(0,s.length/2) : s`。
- **el-table 行也"重复"**：固定左/固定右列另外渲染了一份 `tbody`，`document.querySelectorAll(".el-table .el-table__body tbody tr")` 会拿到 2-3 倍行数。读取数据用主体：`.el-table__body-wrapper .el-table__body tbody`；读取右侧操作按钮用：`.el-table__fixed-right .el-table__body tbody tr`。
- 不要把账号、Cookie、内部 IP 写进 skill 文件外。
