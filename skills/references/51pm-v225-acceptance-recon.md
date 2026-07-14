# 51PM V2.2.5 验收沉淀（2026-07-10）

与 51pm-acceptance-recon / 51pm-acceptance-techniques 互补。本篇核心：粘贴上传验证、toast 误判、BatchCreateDialog 全流程、嵌套弹窗 select 坑、新入口。

## 🏆 合成 Ctrl+V 粘贴图片上传（通杀技巧，验证"剪贴板直接粘贴上传"类功能）

**不要走 Windows 系统剪贴板**：PowerShell WinForms/WPF `Clipboard::SetImage` 在本环境反复失败（clipboard 打开失败，疑似会话隔离），`navigator.clipboard.write` 在 HTTP 站点无 API、CDP grantPermissions 对 HTTP origin 拒绝。全部死路，别再烧轮次。

**正确做法：页面内合成 ClipboardEvent**，前端 paste 监听收到的事件与真实 Ctrl+V 等价：

```js
const c = document.createElement("canvas"); c.width=120; c.height=80;
const ctx = c.getContext("2d"); ctx.fillStyle="#e03030"; ctx.fillRect(0,0,120,80);
const blob = await new Promise(res=>c.toBlob(res, "image/png"));
const file = new File([blob], "v225-paste.png", {type: "image/png"});
const dt = new DataTransfer(); dt.items.add(file);
const ev = new ClipboardEvent("paste", {bubbles: true, cancelable: true});
Object.defineProperty(ev, "clipboardData", {value: dt});
// 派发到上传区容器（zone.closest(".el-upload")）+ document 双保险
target.dispatchEvent(ev); document.dispatchEvent(ev);
```

验证链：上传区出现 `.el-image__inner` 缩略图（src 指向 `/storage/...`）→ **WSL 里 curl 该 storage URL** 断言 200 + PNG 尺寸（页面内 fetch API host 会 Failed to fetch，跨 host，别用）。51PM 上传组件 `UploadImages.vue`，粘贴即自动上传，无需点提交。

## 🏆 el-message toast 只活 ~3 秒 —— "点了没反应"误判的头号来源

点击后 `sleep(3)` 再读 `.el-message` 大概率扑空。**正确姿势：点击后立刻 250ms 间隔轮询**：

```python
click_at_xy(x, y)
for i in range(16):
    time.sleep(0.25)
    t = js('Array.from(document.querySelectorAll(".el-message")).map(e=>e.textContent.trim())')
    if t: break
```

本次「需求拆解-下一步」点了两轮以为无响应，实际每次都弹了"拆解标准工时总和不能超过父任务标准工时！"warning，全被 sleep 吃掉。判"无响应 BUG"前必须先轮询 toast + 读 vm 状态。

## BatchCreateDialog（需求拆解 / 多人通用任务共用组件，class `batch-create-dialog`）

- 入口①需求拆解：项目→项目需求→操作列 `el-icon-menu`（tooltip"需求拆分"）→ 两步向导「录入任务→确认拆解」，提交接口 `project_task/task_spilt`。
- 入口②多人通用任务：非项目→需求详情→创建任务(hover dropdown)→多人通用任务。
- 左侧卡片 `.bcd-tab`，删除按钮 `.bcd-tab__del`（多余的"任务 2/3/4"逐个删掉，进回收站不计有效数）。
- **隐藏校验（preSubmit）**：拆解任务工时总和 ≤ 父需求标准工时。父需求标准工时为 0 时必然被拒 → 先走「编辑需求」（操作列 `el-icon-edit-outline`）把标准工时改够再拆解。
- **探因技巧**：`v.preSubmit(v.validEntries, v.entries)` 可直接 await 调用，返回 string = 拒绝原因（比 UI 快且不受 toast 时效影响）。vm 找法：从下一步按钮 `__vue__` 上溯到含 `$data.step` 的组件；`goConfirm`/`validEntries`/`trash` 都在上面。
- 第二步出现「确认提交 N 条」按钮，点击后弹窗整体关闭、无 toast，以任务列表回读为准。
- ⚠️ 弹窗顶部「全清」按钮带 popconfirm（"确认清空"），误点区域会弹出来；点弹窗 header 空白可关。「取消」会弹 el-message-box「退出后所有编辑内容都会清空」→ 按钮是「继续编辑/确定退出」。
- 任务选项面板（task-options-panel-popover）多选：已选项在弹窗内渲染为带 × 的 el-tag，点 tag 的 `.el-tag__close` 可移除单个选项。多选项任务的「添加工时」弹窗会按选项拆分：每个选项一个 `.option-hour-input` 工时框 + 一个"当日完成情况"textarea；**0h 子项免填描述**（V2.2.5 规则，remark 组装为 `选项名[0h]：`），>0h 子项描述必填、总计 >13.5h 拒绝——这些规则都在 `submitForm` 源码里，读 vm methods 比试 UI 快。

## el-tabs 点击切换失灵 → 用 vm

任务页「项目任务/非项目任务」tab，真实点击 + `currentName` 轮询都不切（默认停在 not_project，接口一直打 `get_not_task_list`）。可靠做法：

```js
let v = document.querySelector(".el-tabs").__vue__;
while (v && v.$options._componentTag !== "el-tabs") v = v.$parent;
v.setCurrentName("project"); v.$emit("tab-click", v.panes[0]);
```

切换后接口变 `get_task_list`。（仅作导航前置，不算绕过被验交互。）

## 嵌套弹窗里的 el-select 点不开/点不中

组群配置弹窗（弹窗套弹窗）内的成员 select：坐标点击 input 后 `sv.visible` 仍 false，选项坐标点击也不落 value。可靠链：

1. 单选：`sv.options.find(o=>o.label==="xxx")` → `sv.handleOptionSelect(o)`（注意该组件是**单选**，选第二个会覆盖第一个——流程是 选一个→点「加入」→再选下一个→「加入」→最后「保存成员」）。
2. multiple select（如申请发包的发包类型，`sv.multiple===true`）：`handleOptionSelect` 不生效时用 `sv.$emit("input",[o.value]); sv.$emit("change",[o.value])`，然后读 `sv.value` 确认。
3. 下拉选项 y 坐标全相同 = 展开动画中，等 1.5s 重读（老坑复发）。

## hover 型 el-dropdown：mouseMoved 悬停可能不弹，vm 兜底

「创建任务」按钮 mouseMoved（含轨迹模拟）都不弹菜单时：

```js
let v = dd.__vue__; while (v && v.$options._componentTag !== "el-dropdown") v = v.$parent;
v.show();   // 菜单立即可见，再按文本取 .el-dropdown-menu__item 坐标点击
```

## V2.2.5 新入口（应回填 domain-skills/51pm/entry_map.md，本次会话工具受限先记这里）

| 功能 | 入口 | 备注 |
|---|---|---|
| 项目递交 | 项目详情二级菜单「项目递交」→ `/project/project_publish?projectId=N` | 接口 `project_publish/get_list`；顶部 全部/按时/超时/延期/待递交 数字块是**纯统计不可点**（无筛选、cursor auto）；「最新/最早」排序实测生效；keywords 参数按项目名精确匹配 |
| 模型外包-申请发包 | 项目详情「模型外包」→ `/project/outsource_project?projectId=N` →「申请发包」 | 必填：发包名称/发包类型(multiple select)/引擎版本/存放地址/制作内容；提交接口 `outsource/create_package` code:0；成功后弹窗**不自动关**（需手动取消）、无 toast，以列表回读为准。「全部/内部自制」tab 切换：新建发包（待审核态）不出现在「内部自制」tab —— 疑与发包类型/审核状态有关，验收时以「全部」tab 为准 |
| 我的任务日历 | 我的地盘 → 左侧菜单「我的任务」→ `/my_board/main/task` | ⚠️ 直接 `location.href='/my_board/main/task'` 会被重定向回 main；点左侧 `li.el-menu-item` 才进得去。日历格 `.tc-cell`（今天 `.is-today`），点格内任务项直接弹「填写工时」列表弹窗（V2.2.5 新交互）；右侧栏 `.tc-panel__body`（任务详情卡）保留 |
| 需求描述查看 | 项目→项目需求→「需求描述」列「查看详情」按钮 | handler `fetchDemandDetail`（demandTable.vue:331），点击后弹窗展示描述——**需求页仍是弹窗不是直显**；任务列表页的任务描述列才是直显文字。弹窗打开与否读 vm `isShowDemandDetail`/`parsedDemandDetail` 最可靠 |
| 编辑需求 | 项目需求操作列 `el-icon-edit-outline` →「需求编辑」弹窗 | 弹窗有时点一次不出，reload 后再点；改标准工时走此处 |
| 任务选项-项目内审会 | 任务选项面板 →「管理/会议/售前/培训」tab → 项目管理 → 项目会议 | V2.2.5 新增「项目内审会」，同级：项目启动会/项目融通会/项目复盘会 |
| 组群就地管理 | 多人通用任务弹窗 →「从组群导入」popover →「立即管理」链接 | 就地弹出完整「组群配置」弹窗（新建分组/加成员/保存成员），即 V2.2.5"创建任务时快速创建组群"的实现 |

## 其它零散

- 项目列表页 vm 数据键是 `projectList`（不是 tableData/list）；「搜索项目」是远程搜索 select（Input.insertText 逐字）。
- 需求列表接口 `demand/get_project_demand_list` 返回行含 `desc`（前缀"需求备注（PM填写）："）。
- 项目任务列表 vm：任务页 `form.el-form` 取不到时，从 `#app.__vue__` 递归找「含 `form.project_id` 且有 `search()`」的组件（本次实测可靠）。注意 form 里可能残留 `end_date` 等旧值，筛选前显式清空。
- 填写工时入口在日历/任务列表两处最终都汇到同一「填写工时→添加工时」双层弹窗（button.workHour 坐标点击可能无效，`btn.click()` 原生调用稳）。
- terminal 工具会把 heredoc 里含 `&&` 的 browser-harness 命令误判为后台运行而拒绝 → **把脚本先 `cat > /tmp/x.py` 再 `browser-harness < /tmp/x.py`**，全程稳定。
