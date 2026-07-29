# 🕳️ 踩坑台账（pitfalls-ledger）

> 用途：把历轮验收/回归踩过的坑记成**一屏可通读**的规律表，记一次、防终身。
> **阶段 0 必读**：每轮开跑前通读全表，命中症状的按修法直接规避；
> **阶段 4 收尾**：本轮新踩的坑按下列收录标准判断是否入账——这是核销表的**独立一项 `pitfalls`（不是"顺带"）**，无新坑也要显式写「无」。
>
> 收录标准：
> - 只收**可复用规律**（下轮还会撞上的）；一次性数据/坐标/文案不收；
> - 一条 ≤3 行；同类坑第 2 次出现**合并计数**、更新修法，不另开新条；
> - 坑的**规则**升级进 SKILL 正文协议后，台账保留**根因与案例细节**（SKILL 正文只留一句规则 + `P-xx` 引用），二者不重复展开。

| 编号 | 症状规律 | 根因 | 修法（协议位置） | 命中 | 最近 |
|---|---|---|---|---|---|
| P-01 | 回归几乎全红，被误判「后端宕机」白跑 10+ 分钟 | 登录态只看 `Test-Path auth/state.json`——token 因 SSO 过期失效但文件还在 | 阶段 0 强制 `npm run check`（0=有效/2=过期/3=不可达）；文件存在 ≠ token 有效 | 1 | 2026-07-21 |
| P-02 | 让用户扫码续登，用户连问「二维码在哪」 | `npm run login` 另开独立有头 Chrome，常被其它窗口挡住/弹到屏幕外 | 集成浏览器打开 app → 自动跳 CAS 扫码 → `evaluate` 取 `oauthToken` 改写 `auth/state.json`（阶段 0） | 1 | 2026-07-21 |
| P-03 | 全红后拿裸 TCP（`Test-NetConnection`/`node http`）直连后端端口，refused 就断言宕机 | refused/`socket hang up` 不代表服务状态，会误导 | 第一动作 `npm run check` 复核；再看 `test-results/*/error-context.md` 区分 401 与连接错（阶段 1） | 1 | 2026-07-21 |
| P-04 | 8888 转发/接口整体打不通 | 后端 IP 会漂移（.183→.189），前端写死 `localhost:8888` | `start-proxy.js` 的 `TARGET_HOST` 单一真源；浏览器 performance 看 `manage_api` 真实 host | 1 | 2026-07-21 |
| P-05 | 造前置数据撞权限门禁，切角色后登录态报废 | 右上角切换角色可能触发重新扫码 | 不切角色、不死磕禁用按钮；读按钮 Vue 组件直调处理方法开表单，后续表单仍真实点击（阶段 2 唯一例外） | 1 | 2026-07 |
| P-06 | 造数请求报 `Unexpected token '<'` | UI spec 的 baseURL 是前端 7777，相对路径 `/manage_api/...` 打到前端返 HTML | `ensureXxx` 一律用 `API_BASE`（`http://localhost:8888`）绝对地址（阶段 4 第 1 条） | 1 | 2026-07 |
| P-07 | 老功能重构后，旧版本 spec 用例每轮永久红 | 新规格用例写进了新版本 spec，与旧用例并存 | 就地更新旧版本 spec 断言；先例：V2.2.9 概况改手风琴 → 修的是 `v2.2.6.spec.js` ③，不在 v2.2.9 新写 | 1 | 2026-07 |
| P-08 | 数据依赖用例批量红或长期 skip（skip = 没测） | 测试库不定期整体刷新，落库数据随时清空 | 幂等造数 `ensureXxx`（marker 查→命中复用→未中才 POST）；确实造不出才 skip 并注明恢复法（阶段 4 第 1 条） | 多 | 2026-07 |
| P-09 | 交付截图右侧大块留白/不完整 | 用 VS Code 集成浏览器 `page.screenshot` 出图（视口被侧栏挤压/异步回弹）；**探索时随手截的集成浏览器图被直接当交付图用**是重复根因 | 硬规则：**final-*.jpg 一律写 headless 脚本用 launchLoggedIn+shot() 出（shot 断言 innerWidth===1920）；禁用集成浏览器 page.screenshot 产交付图，探索图不得复用为交付图**（阶段 2 截图纪律） | 2 | 2026-07-29 |
| P-10 | html 交付物缺「发版内容」节，与 md 不同步 | 阶段 2 提前转了 html，初稿回填后没重转 | 全流程唯一一次 md→html 转换放在阶段 3 初稿写回之后 | 1 | 2026-07 |
| P-11 | 照文档跑 pandoc 转 html 先失败一次 | 本机无 pandoc；转换器首选是 `node scripts/md2html.js`（标准库 markdown-it，非手搓） | 首选 md2html.js（阶段 3，见 stages/stage3-release.md）；pandoc 仅备选 | 1 | 2026-07-29 |
| P-12 | el-table 固定列/固定表头里的图标（编辑/项目名/提示图标）点击被 fixed-header/fixed-column 拦截或落空 | 固定列是克隆节点、固定表头浮在上层，locator.click 常被上层元素 intercept | 需要目标行 id 时用 `request` 取 `get_project_list` 等列表拿 id → 直达 `/project/project_form/{id}` 等 URL 绕开点击；必须点固定列元素时改 JS 原生 `el.click()` | 2 | 2026-07-29 |
| P-13 | 验收「被验写入功能」撞前端权限门禁（`systemRole`/`testListRooters` 禁用按钮）时，用「需 PM/白名单账号补一轮」搪塞 punt，写成覆盖盲区 | 把展示层禁用当成不可逾越，忘了门禁可绕过真实走查 | ①解除 `btn.disabled=false` + 真实点击触发原生 @click，或 ②Vue 直调背后方法（`handleProcess(index,row,dev)`/`approvedApply(row)`/`handleSolveApply(row)`）打开表单 → 真实填写提交；后端放行=越权缺陷写 §二，后端拒绝=门禁一致；仅「无待处理样本(数据状态)/真正不可逆破坏」才算合理未做（阶段 2 §0 唯一例外的延伸） | 1 | 2026-07-29 |
| P-14 | 表单必填项被变相跳过：①用改开关/切状态（如临时状态是→否）避开条件必填项；②日期类必填用 `vm.$emit('input',Date)` 静默不落库（前端看似有值、后端存空/`0001-01-01`）却仍提交成功 | 误把“表单能提交”当成“必填项已填”；日期控件模型绑定靠 @input 字符串非 Date 对象 | **必填项必须如实填全、不得改状态规避**；日期走 `input.fill('YYYY-MM-DD')`+`Enter`（el-date-picker 接受键入提交），提交前读 vm.form 相应字段确认非空、提交后回查落库；多选下拉选后再点选择器自身收起再提交（开着提交会清值）；关下拉用选择器/Esc，**禁用 mouse.click(小坐标) 关下拉**（会点到模态遮罩关掉整个弹窗丢表单） | 1 | 2026-07-29 |
