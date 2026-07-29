# 51PM 验收-测试-发版 独立工作区

> 51PM 的验收/测试/发版全流程在本目录进行。
> 执行方式：VS Code 里打开本目录，用 Copilot 对话框驱动（新功能探索）+ Playwright 回归脚本（老功能回归）。

## 目录结构

```
51PM验收-测试-发版/
├── README.md            ← 本文件
├── skills/              ← 验收/发版技能文档（总控 + 专项 + 资产库）
│   ├── SKILL.md                ★ 全流程总控（薄路由调度器，各阶段细则委托 stages/）
│   ├── stages/                 阶段执行细则（唯一执行来源）：stage01-regression / stage2-acceptance / stage3-release / stage45-sediment
│   ├── release_notes.md        阶段 3 发版内容生成规范（分类/强度/句式/红黑榜）
│   ├── entry_map.md            ★ 入口地图：所有实测入口与坑，每轮验收后必须回填
│   ├── impact_map.md           ★ 影响面索引：功能↔共享表/接口，反查精准回归目标
│   ├── pitfalls-ledger.md      踩坑台账（阶段 0 必读逐条自查）
│   ├── playbooks/              操作库 SOP：每个功能「怎么做完一件事」的分步流程
│   └── references/             历轮实测勘察笔记
├── acceptance/          ← 历轮验收产物（每版本一目录：报告 md/html + final-*.jpg，有缺陷另出 fix-handoff.md）
│   └── V2.2.3/ … V2.3.0/ …
└── regression/          ← ★ Playwright 回归脚本库
    ├── package.json / playwright.config.js
    ├── auth/state.json         登录态（企微 OAuth，鉴权走 Bearer token）
    ├── scripts/
    │   ├── start-proxy.js      本机 8888 → 后端 8888 TCP 转发（后端 IP 单一真源，会漂移）
    │   ├── check-login.js      登录态有效性自检（npm run check）
    │   ├── save-login-state.js / headless-login.js  登录 / 无头登录出图
    │   └── global-setup.js / global-teardown.js
    └── tests/
        ├── helpers.js          公共封装（导航/弹窗/公告关闭 + 幂等造数 ensureXxx，坑注释在函数上）
        └── v{版本}.spec.js / api-v{版本}.spec.js   各版本回归用例（UI + 纯接口）
```

## 每周验收工作流

> ★ 全流程总控 SKILL：[skills/SKILL.md](skills/SKILL.md) —— 在 Copilot 对话框发「验收 V2.x.x + 本周开发内容」即可按下面阶段自动串联执行。各阶段执行细则在 [skills/stages/](skills/stages/)。

0. **环境自检**：`cd regression && npm run check`（退出码 0=登录态有效 / 2=过期需续登 / 3=后端不可达）；并通读 [skills/pitfalls-ledger.md](skills/pitfalls-ledger.md)
1. **拆清单 + 精准回归**：把本周开发内容拆成验收清单（含预判落库维度）→ 查 [skills/impact_map.md](skills/impact_map.md) 选簇 `npx playwright test --grep "@簇A|@簇B"` 精准跑 + `tests/api-*.spec.js` 冒烟兜底（**不再默认全量盲跑**）
   - 全绿 → 老功能没被改坏（哨兵用例 BUG 未修复时为预期失败，也计绿）
   - 意外红 → 可能是回归 BUG，看 `npx playwright show-report`；「已知BUG跟踪」用例 unexpected pass = 开发已修复，删 `test.fail()` 转常规断言
2. **新功能验收**：在 Copilot 对话框贴本周开发内容，按 [skills/stages/stage2-acceptance.md](skills/stages/stage2-acceptance.md) 真实 UI 走流程、四层覆盖，产物写入 `acceptance/{版本}/`
3. **发版初稿**：按 [skills/release_notes.md](skills/release_notes.md) 生成初稿写进验收报告，转 html 交付（定稿与归档由用户在发版管理自行完成，**agent 不碰发版记录**）
4. **沉淀**：走通路径→ `tests/v{版本}.spec.js`、接口→ `api-v{版本}.spec.js`；回填 [entry_map.md](skills/entry_map.md) / [impact_map.md](skills/impact_map.md) / [playbooks/](skills/playbooks/)
5. **缺陷复验**（非每轮）：开发修复回传后定点复验 + 命中簇回归 + 哨兵销账

## 首次/环境恢复步骤

```powershell
cd regression
npm install                  # 装 @playwright/test
npx playwright install chromium
npm run check                # 登录态自检（0=有效可直接跑；2=过期→续登）
npx playwright test --grep "@簇名"   # 精准回归
```

- 登录态过期（`npm run check` 退出码 2 / 用例批量跳登录页）→ **优先用 VS Code 集成浏览器扫码续登**（打开 app 自动跳 CAS 二维码，扫完取 `oauthToken` 改写 `auth/state.json`）；集成浏览器走不通才回退 `npm run login`。**agent 不代输任何凭据**
- 8888 转发由 globalSetup 自动起；单独常驻可跑 `npm run proxy`
- 写链路用例（真实上传/提交）默认跳过：`$env:RUN_WRITE=1; npx playwright test --grep @write`（幂等造数用例不打 @write，每轮真跑）

## 测试环境关键信息

| 项 | 值 |
|---|---|
| 测试环境 | http://10.67.8.183:7777（有"当前为开发环境"水印；验收默认此环境） |
| 后端 API | 10.67.8.189:8888（**IP 会漂移**，单一真源见 `regression/scripts/start-proxy.js` 的 `TARGET_HOST`；前端写死 localhost:8888 需本机转发） |
| 测试数据 | 测试库与正式库完全隔离、真实项目只是副本 → **任意项目均可随便挑、直接写，无污染顾虑**（测试库会不定期整体刷新，别写死项目 ID） |
| 登录 | 企微 OAuth（cas-test.51aes.com）；鉴权走 Bearer token，与 cookie 无关 |

