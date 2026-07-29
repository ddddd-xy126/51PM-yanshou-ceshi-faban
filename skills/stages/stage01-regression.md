# 阶段 0-1 执行文档 · 环境自检 + 拆清单与精准回归

> 本文件是 [总控 SKILL](../SKILL.md) 阶段 0 与阶段 1 的**唯一执行细则**（单一出处）。进入阶段 0/1 的第一动作是读本文件；产物与写盘要求见总控「阶段路由」表。

## 阶段 0：环境自检（每轮开跑前）

```powershell
cd regression
# 1. 依赖就绪？（首次或环境恢复才需要）
if (!(Test-Path node_modules)) { npm install; npx playwright install chromium }
# 2. 登录态有效性自检（关键：文件存在 ≠ token 有效）
npm run check     # 退出码 0=有效可继续；2=已过期→停下提示用户 npm run login；3=后端不可达/IP 漂移
```

命令之外还有一步：**通读 [pitfalls-ledger.md](../pitfalls-ledger.md) 全部条目**（一屏内）——命中本轮场景的坑直接按修法规避。这是每轮开跑前的强制自查，收录标准见该文件表头。

### ⭐ 登录态自检必须在阶段 0 做，别等阶段 1

`npm run check` 用存档 token 直连后端打认证接口，秒级判断有效/过期（有效 `code=0`，过期 `code=444 用户不存在`）。

> **只 `Test-Path auth/state.json` 是错的**——token 会因 SSO 过期而失效，文件却还在（台账 P-01）。

**退出码 2（已过期）**：需用户扫码续登，**agent 不代扫任何凭据**。

- ⚠️ **扫码务必走 VS Code 集成浏览器，别用 `npm run login`**——后者另开的有头 Chrome 窗口常被挡住，用户看不见二维码（台账 P-02）。
- 正确姿势：
  1. 用集成浏览器 `open_browser_page` 打开 `http://10.67.8.183:7777/` → app 401 会自动跳 `cas-test.51aes.com/loginPage`，二维码 iframe 就显示在 VS Code 里，用户可见即扫；
  2. 用户扫完页面回 `my_board/main/main` 后，`page.evaluate(()=>localStorage.getItem('oauthToken'))` 取新 token，**直接改写 `auth/state.json` 里 origins 的 `oauthToken` 值**（集成浏览器 `Storage.getCookies` 不可用、拿不到 httpOnly 的 SESSION，但后端鉴权走 `Bearer token`，只更新 oauthToken 即可让 `npm run check` 通过 `code=0`）；
  3. 重跑 `npm run check` 确认有效再进阶段 1。
- 仅当集成浏览器扫码走不通时才回退 `npm run login`。

**退出码 3（后端不可达）**：多半是后端 IP 又漂移了——浏览器打开 app 看 performance 里 `manage_api` 的真实 host，改 [start-proxy.js](../../regression/scripts/start-proxy.js) 的 `TARGET_HOST`（全仓库后端地址单一真源，proxy 与 check 都引用它）。

### 环境固定

固定为测试环境 `10.67.8.183:7777`，不再询问。仅当用户明确说「正式环境」才切换，且写操作逐项问。

## 阶段 1：拆清单 + 按影响面精准回归（清单先行，不全量盲跑）

> **回归 = 新功能碰哪块老地盘就回归哪块**（影响面驱动）。顺序为：先把 dev_notes 拆成验收清单（一次解析、阶段1 选集与阶段2 验收两处复用），再由清单的「预判落库维度」查 [impact_map.md](../impact_map.md) §B 选回归目标。**UI 全量不再默认跑**，兜底改用 api 冒烟（纯接口秒级）。

### ① 拆验收清单（原阶段2 第1步，前移至此）

对 `dev_notes` 逐条解析，产出验收清单，每项包含（入口先查 [entry_map.md](../entry_map.md)）：

```
- 功能名：（从开发内容里提炼）
- 推测入口：「一级菜单-二级页面」（参考 README 主模块表；拿不准就标"待现场找"）
- 计划流程：作为真实用户会怎么走（3~8 步）
- 观察点：这条功能"对/不对"分别长什么样
- 预判落库维度：落在哪张表/接口命名空间（对照 impact_map §A；拿不准多标候选，宁多勿漏——供本阶段推导精准回归目标）
```

清单输出后**不等用户确认，直接进 ②**。仅当开发内容有明显歧义、无法推进时才提问；用户看到清单后若有纠正会随时打断。数据前置条件缺失（测试项目没需求/没任务等）直接补建数据继续，不需询问。

**⚠️ 清单必须落盘**：拆完立即把每项写进 `.pipeline-state.json` 顶层 `checklist[]`（`{name, entry, tables:[预判维度]}`）——它是阶段 2「不重拆、直接开跑」的唯一输入；只留在对话上下文时，会话一旦断在阶段 1↔2 之间就丢失（状态写盘机制正为此设）。

### ② 精准回归（主力）

```powershell
cd regression
# 清单「预判落库维度」命中哪些簇就跑哪些标签
#    标签=impact_map §B 簇名（@project_publish/@project_moment/@demand/@project_task/
#    @outsource/@user_group/@schedule/@data_export/@estimate/@project_detail/@task_options 等）
npx playwright test --grep "@project_publish|@project_moment"   # 示例：本轮碰递交+项目动态
# 需要真实写链路时（会产生测试数据）：
$env:RUN_WRITE=1; npx playwright test --grep @write
```

- 汇总清单各项的「预判落库维度」→ 查 impact_map §B 得命中簇 → `--grep "@簇A|@簇B"` 跑这些簇的全部老功能用例。命中「独立维度」（produce_demand/pm_theme/uga）的功能基本不外溢，只回归自身。
- **精准选集覆盖「全部命中簇」，簇多不是转全量的理由**：碰几个簇就 grep 几个簇，`@A|@B|@C|@D|@E` 可任意叠加——发版内容多、跨簇多，依然是把这些簇**全部精准跑**（这才是"精准测全部"），而不是因为簇多就退回盲跑全量（全量只会把**没碰的簇**也跑一遍，纯浪费）。

### ③ 轻量冒烟兜底（替代 UI 全量）

```powershell
npx playwright test tests/api-*.spec.js   # 全部 api spec：不开浏览器，秒级跑完
```

- api spec 覆盖多簇后端契约（列表结构/边界参数/已知BUG哨兵），后端被改坏最先从接口层暴露，是低成本的漏判安全网。
- **UI 全量（`npx playwright test`）只在「影响面根本界定不了」时才兜底**：a) 清单里功能↔簇的映射**普遍拿不准**（单功能候选维度 ≥3 且难取舍），或改动是全局底座（登录/路由/全局布局/主题引擎等）无法归到具体簇；b) 阶段2 验收实锤口径与预判不符 → 补跑**差集簇**的 `@标签`（仍是精准，不必全量）。**"碰了 N 个簇"本身（N 再大）不触发全量——碰到的簇全 grep 上即可。**
- ②③ 结果均按下表判读。

### 结果判读（三种颜色三种动作）

| 结果 | 含义 | 动作 |
| --- | --- | --- |
| 全绿 | 老功能没被本次发版改坏（含哨兵用例：BUG 仍在 = 预期失败 = 绿） | 直接进阶段 2 |
| 「已知BUG跟踪」用例 unexpected pass（红） | 开发已修复该 BUG，哨兵用例的 `test.fail()` 标记过时 | 删掉 `test.fail()` 转常规断言，并把 BUG 从 entry_map 备注中销账 |
| 预期内规格变更用例红（dev_notes 已声明本轮改了该老功能） | **不是回归 BUG**——旧用例断言的是重构前规格，代码已按新规格改 | 该老功能本轮即验收对象；**把待改项登记进 `.pipeline-state.json` 顶层 `pendingSpecUpdates[]`**（如 `v2.2.6③ 概况改手风琴`），阶段 4 第 1 条据此**就地更新其旧版本 spec 用例**（改断言/迁移/删除）后清零，不当 BUG、不新写并存用例（登记而非只在对话里"标记"，防跨阶段/跨会话丢失，先例见台账 P-07） |
| 其他用例意外红 | 疑似回归 BUG（dev_notes 没提却红 = 重构副作用波及） | 先复跑一次排除偶发；仍红则看现场，作为 🐛 记入报告继续往下跑，**不中断等用户** |

- 回归失败排查顺序：登录态过期（批量跳登录页，**阶段0 `npm run check` 应已拦住**）→ 8888 转发没起/后端 IP 漂移 → 测试库刷新致数据缺失 → 才是真回归 BUG。
- 🚫 几乎全红时**第一动作是 `npm run check` 复核，严禁凭裸 TCP 直连后端端口就断言「后端宕机」**（台账 P-03）。仍要深挖看 `test-results/*/error-context.md` 是 `401/登录失效` 还是连接错误。
- **测试库刷新致数据缺失**：失败报错含「测试数据缺失 / 被清空需先重建」时，**不要重建数据、不要复跑、不要继续耗时间**——立即终止本轮回归，在报告顶部回归徽章与附录 A.1 标注「回归跳过：测试库刷新致数据缺失」并列出受影响用例，直接进阶段 2。数据重建只在用户明确要求时做。
- 回归结论（x 通过 / y 失败 / 哨兵状态）写进阶段 2 报告的**顶部回归徽章（一行）+ 附录 A.1**，不再当开篇头条。
