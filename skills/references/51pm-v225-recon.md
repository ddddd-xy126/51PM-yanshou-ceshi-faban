# 51PM V2.2.5 验收实测沉淀（2026-07-10）

与 51pm-acceptance-techniques.md 互补，本篇聚焦：项目详情子模块导航、需求拆解向导（TaskBatchCreate 变体）、项目递交模块、任务选项面板多选坑。

## 项目详情页导航（projectId 必带）

- 项目列表 → 点**项目名文字**（fixed 左列中的 SPAN）→ 跳 `/project/project_detail?projectId=N`。点「查看详情」按钮是项目日报，不是详情页。
- 项目详情二级菜单（水平 el-menu）：售前支持 / 项目概况 / 报价单需求 / **项目需求** / 复用功能 / 项目动态 / **项目递交**(V2.2.5新增) / 项目新增变更 / 项目反馈 / 项目复盘 / 项目采购 / **模型外包**。
- ⚠️ **点二级菜单项经常不跳转**（elementFromPoint 命中问题 / vue-router 内部切换无 URL 变化不可靠）。**更稳的做法：直接 `window.location.href` 导航到子路由并带 projectId**：
  - 项目需求 = `/project/demand?projectId=N`
  - 项目递交 = `/project/project_publish?projectId=N`
  - 模型外包 = `/project/outsource_project` 系（路由表见下）
- 路由全集用 `$router.options.routes` 递归枚举（recon 篇方法），V2.2.5 相关新路由：`/project/project_publish`、`/project/outsource_project`、`/project/outsource_detail`、`/supplier_portal/outsource/:projectId`。
- ⚠️ 点项目列表里的元素有时会「跳回我的地盘」——是误点到别处触发路由复位，跳错后重新 `location.href` 回目标页即可，别慌着重查。

## 项目递交模块（/project/project_publish）

- 接口 `project_publish/get_list`。⚠️ **`keywords` 参数搜的是历史递交记录里的项目名**，没有递交记录的项目搜不到（total=0 ≠ BUG）；带 `project_id=N` 直查最可靠。
- 页面结构：统计条（全部/按时/超时/延期/待递交 + 数字）+ 最新/最早排序 + 时间轴卡片。**统计数字块是纯展示不可点筛选**（cursor:auto、点击不发新请求）——V2.2.5 验收已实测，不要当 BUG 报"筛选失效"，报体验建议即可。
- 排序「最新/最早」真实生效（点文字后首卡日期翻转）。
- 空项目显示「该项目暂无递交记录」空状态文案。

## 需求创建（/project/create_demand）

- 项目需求页「创建需求」是**普通按钮直接点**（不是 hover dropdown），跳 `create_demand` 表单页。
- 必填：所属项目（自动带出）、需求性质（el-select）、需求名称、指派给（el-select filterable，选项几百人）。
- ⚠️ **el-select 键盘导航选项计数不可靠**（ArrowDown N 次落点可能偏，如按 4 次落到第 5 项）——每按一次读 `.el-select-dropdown__item.hover` 文本确认，到目标才 Enter。或对 filterable select：`Input.insertText` 过滤后找到目标项 `scrollIntoView({block:"center"})` + 重读坐标再点击（跨页长列表实测稳）。
- 提交接口 `project_task/add`，code:0 返回新需求 id。需求和任务共用 task 表（需求 id 即 task id）。

## 需求拆解向导（需求行操作列 el-icon-menu「需求拆分」）

两步向导弹窗「需求拆解」，与批量创建组件同族。实测坑合集：

1. 操作列按钮无文字，**靠 tooltip 内容识别**：`btn.__vue__` 向上找 `v.content`（关联新增/变更、重置为进行中、完工、编辑、需求拆分、删除）。
2. 任务选项 = task-options-panel-popover（同 techniques 篇），但**它是多选 checkbox 面板**：点一级「项目会议」会**默认全选/带上第一个子项**（实测出现「项目启动会、项目内审会」两个 tag）。选完检查 `.el-tag` 列表，多余的点 tag 上的 `.el-tag__close` 摘掉。
3. 面板关闭：**绝对不要按 Esc**——Esc 会把整个拆解弹窗一起关掉，所有已填内容丢失。点弹窗 header 空白处收面板。
4. 「全清」按钮带 popconfirm（确认清空），误触后**点 header 空白处关闭气泡**，同样不要 Esc。
5. 指派给：placeholder="指派给" 的 filterable el-select，`Input.insertText` 输姓名过滤后点选项。「我」快捷按钮实测点了不生效，老实走 select。
6. 工时（placeholder="0.0"）、描述（textarea）用 native setter；起止日期用 el-date-picker vm `$emit("input",[s,e])+$emit("change",...)`，字符串 "YYYY-MM-DD" 数组即可。
7. 任务卡状态从「待完善」变「已完善」+「有效 N」+「下一步（N/4）」计数增加 = 该条可提交。默认给了 4 条空任务坑位，只填 1 条也行（有效 1 即可下一步）。
8. ⚠️ 未解之谜（本轮撞迭代上限）：「下一步」按钮 enabled、click_at_xy 坐标正确，但点击后向导不进第二步（无 popper、无报错）。下次先试 `btn.click()` 原生调用或找按钮 vm 的 handler 直调，并 hook XHR 看有没有校验请求。

## 项目需求列表页（/project/demand）DOM

- 需求描述列显示「查看详情」**按钮**（demandTable.vue）——V2.2.5 发版说"任务描述直接展示"验的是**任务**维度，需求列表描述列仍是弹窗按钮，两者别混。
- 需求名称在**固定左列** `.el-table__fixed .el-table__body`，带 el-popover 全名提示；主体 tbody 首列 is-hidden。
- 操作列在 `.el-table__fixed-right`。

## 其它

- **terminal 工具会把 heredoc 里 JS 的 `&&` 误判成 shell 后台符拒绝执行**——js 表达式里避免写 `&&`（用嵌套三元/`filter().find()` 拆开），或整段放进 `js('''...''')` 时确认 Python 字符串里没有裸 `&`成对出现。实测 `e.offsetParent && /^待递交$/...` 被拒，改成 `.filter(e=>e.offsetParent).find(...)` 通过。
- 项目列表页搜索：placeholder="搜索项目" 是远程搜索 select，`Input.insertText` 逐字输入触发；表格数据 vm 字段是 `projectList`（不是 tableData）。
- 项目列表页**没有 form.el-form vm**，取数从 `.el-table` 上溯找 `$data.projectList`。
