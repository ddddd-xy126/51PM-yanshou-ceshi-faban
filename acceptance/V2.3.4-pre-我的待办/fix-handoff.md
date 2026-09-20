# 51PM V2.3.4-pre-我的待办 缺陷修复交接（给前后端开发，可整份投喂 AI）

> 与 acceptance-report.md §二 共用 B# 编号；修完请按各条「通过标准」自验，回传时注明 B#。

## B1 待办中心顶部 Tab「已逾期」与其余状态组合时 source_keys 计算错误、高亮态不重置

- 严重度：一般
- 复现：
  1. 环境 `10.67.8.183:7777`，账号邓欣羽（user_id=475），进入「我的地盘 → 我的待办」(`/my_board/main/my_todo`)
  2. 点击侧栏叶子分类「发包待立项」（此时请求 `source_keys=outsource_establish`）
  3. 点击顶部 Tab「已逾期」（`.tcb-stat.is-alert`）——请求变为 `source_keys=<全量11项>&only_overdue=1`，该 Tab 正确变为 `is-active is-alert`
  4. 点击顶部 Tab「待处理」（`.tcb-stat` 的第 1 个）
  5. 观察：请求变为 `source_keys=bug_assigned,bug_verify,moment_risk&scope=pending&only_overdue=1`（既非全量 11 项、也非任何单一分类的正常子集，且遗漏了 hour_todo），页面显示"没有符合当前筛选条件的记录"；同时 DOM 里「已逾期」的 `is-active` 类**未被移除**，与「待处理」同时呈现 `is-active`（4 个顶部 Tab 里唯独「已逾期」不遵循与另外 3 者互斥的规则）
- 现象：
  - 预期（若"已逾期"设计为可与其他 3 态组合的 AND 过滤）：点击"待处理"时应表现为「全量 11 个来源中的逾期项」，即与单独点击"已逾期"完全相同的请求 `source_keys=hour_todo,publish_approve,moment_mention,outsource_audit,outsource_establish,demand_accept,outsource_close,bug_assigned,feedback_split,bug_verify,moment_risk&only_overdue=1`
  - 实际：请求变为 `source_keys=bug_assigned,bug_verify,moment_risk&only_overdue=1`（只有 3 个 key，且不含 hour_todo），与"待审批"组合已逾期时（`source_keys=publish_approve,outsource_audit,outsource_establish,demand_accept,outsource_close,feedback_split&only_overdue=1`，能正确查到真实逾期记录）的正确表现形成对比，证明只有"待处理"这条路径的 source_keys 计算存在错误
  - 附截图：`01-待办中心-bug-已逾期状态叠加未重置.jpg`（同目录）
- 定位线索：
  - 页面路由 `/my_board/main/my_todo`
  - 相关 Vue 组件（据 DOM `data-insp-path` 属性推断）：`src/views/routerViews/my_todo/TodoCenterBoard.vue`（顶部四态 Tab 所在容器，class `.tcb-head`/`.tcb-stat`）、`src/views/routerViews/my_todo/components/TodoSourceNav.vue`（侧栏分类树）
  - 接口命名空间：`manage_api/todo_center/get_list`，关键参数 `source_keys`、`only_overdue`
  - 怀疑点：顶部 Tab 的 `is-active` 状态管理可能各自独立维护（而非统一的单选/多选状态机），且"待处理"对应的 source_keys 计算逻辑里可能错误地做了"全量 11 项 - 已选中的其他类目"这类差集运算，而非正确读取"全量 11 项"
- 通过标准：依次点击「发包待立项」→「已逾期」→「待处理」后，① 顶部 4 个 Tab 中同一时刻最多只有「已逾期」与另一个非「已逾期」态同时呈 `is-active`（若产品确认支持组合过滤），且此时请求的 `source_keys` 必须等于全量 11 个 source_key（`hour_todo,publish_approve,moment_mention,outsource_audit,outsource_establish,demand_accept,outsource_close,bug_assigned,feedback_split,bug_verify,moment_risk`）+ `only_overdue=1`；② 或者产品确认不支持组合过滤，则点击"待处理/待审批/未读通知"任一者时必须清除"已逾期"的 `is-active` 与 `only_overdue` 状态，恢复为该 Tab 单独点击时的正常请求

## B2 「发包待结项」待办「前往原页面」跳转精度低于「发包待立项」

- 严重度：轻微
- 复现：
  1. 同上环境，进入「我的地盘 → 我的待办」
  2. 点击侧栏「待我审批 → 发包待结项」，选中一条待办如「北交大铁路孪生项目 / 20260810斜扫建模L3第三批」（对应 sj_num=SJ202605120002，project_id=6710）
  3. 点击右侧详情面板「前往原页面」按钮
  4. 对比：同样操作对「发包待立项」类目下的待办执行「前往原页面」
- 现象：
  - 「发包待立项」跳转后地址栏 `project/outsource_project?projectId=N`，且**搜索框「搜索发包名称」被自动填充为目标发包名称**，列表精确筛选为「共 1 条」
  - 「发包待结项」跳转后同样到 `project/outsource_project?projectId=6710`，但**搜索框为空、状态筛选仍为"全部状态"**，显示该项目全部「共 5 条」发包记录（各种状态混合），需要用户自行输入发包名称手动搜索才能定位到目标记录「20260810斜扫建模L3第三批」
  - 数据本身核对完全正确（手动搜索后确认合同金额¥4,000.00、8人天、UE5.5、制作中、2026-08-06~08-12 均与待办中心展示一致），仅跳转精度体验不一致
  - 附截图：`02-待办中心-bug-发包待结项跳转不精确.jpg`（同目录）
- 定位线索：
  - 页面路由：待办中心 `/my_board/main/my_todo` 详情面板「前往原页面」按钮 → 目标页 `project/outsource_project?projectId=N`
  - 怀疑点：「发包待立项」跳转时除 `projectId` 外应还传递了发包名称/编号等参数用于目标页自动填充搜索框（或目标页监听了某个 query 参数并自动 setSearchKeyword），而「发包待结项」的跳转实现遗漏了这一步，只传了 `projectId`
- 通过标准：「发包待结项」待办点击「前往原页面」后，目标页 `project/outsource_project?projectId=N` 的「搜索发包名称」输入框应自动填充为该待办对应的发包名称（或等效地自动定位/高亮到目标行），使列表精确收窄为「共 1 条」，与「发包待立项」的跳转体验保持一致
