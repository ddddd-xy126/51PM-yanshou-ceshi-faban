# 51PM 验收-测试-发版 独立工作区

> 自 2026-07-14 起，51PM 的验收/测试/发版全流程在本目录进行，**不再依赖 Hermes**。
> 执行方式：VS Code 里打开本目录，用 Copilot 对话框驱动（新功能探索）+ Playwright 回归脚本（老功能回归）。

## 目录结构

```
51PM验收-测试-发版/
├── README.md            ← 本文件
├── skills/              ← 验收/发版技能文档（迁自 hermes-agent domain-skills/51pm，9 个文件）
│   ├── release_acceptance.md   验收流程 skill（拆清单→走流程→分级→报告模板）
│   ├── release_notes.md        发版内容生成 skill
│   ├── entry_map.md            ★ 入口地图：所有实测入口与坑，每轮验收后必须回填
│   └── ...（工时/日报/排期等其他 51pm 技能）
├── acceptance/          ← 历轮验收产物（报告+截图，迁自 hermes-agent，61 个文件）
│   ├── V2.2.3/  V2.2.4/  V2.2.5/（Hermes 首轮）  V2.2.5-copilot/（Copilot 复测轮）
├── 发版记录/            ← 旧发版仓库（迁自 D:\project\51PM发版\51PM-Version，9 个文件）
│   ├── 发版.md                 历史最终发版文档
│   └── 发版最新资源截图/
└── regression/          ← ★ Playwright 回归脚本库
    ├── package.json / playwright.config.js
    ├── auth/state.json         登录态（企微 OAuth，过期后重跑 npm run login）
    ├── scripts/
    │   ├── start-proxy.js      本机 8888 → 10.67.8.183:8888 TCP 转发（前端 API 写死 localhost:8888）
    │   ├── save-login-state.js 一次性登录（有头浏览器，企微客户端点确认）
    │   └── global-setup/teardown.js
    └── tests/
        ├── helpers.js          公共封装（导航/弹窗/公告关闭等，坑都注释在函数上）
        └── v2.2.5.spec.js      V2.2.5 八项回归用例
```

## 每周验收工作流

> ★ 全流程总控 SKILL：[skills/SKILL.md](skills/SKILL.md) —— 在 Copilot 对话框发「验收 V2.x.x + 本周开发内容」即可按下面四阶段自动串联执行。

1. **回归**（几分钟）：`cd regression && npx playwright test`
   - 全绿 → 老功能没被改坏
   - 意外红 → 可能是回归 BUG，看 `npx playwright show-report`
   - 「已知BUG跟踪」用例红是正常的（开发修复后自动转绿，转绿后把它改成常规断言）
2. **新功能探索**：在 VS Code Copilot 对话框贴本周开发内容，按 [skills/release_acceptance.md](skills/release_acceptance.md) 流程现场验收（产物写入 `acceptance/{版本}/`）
3. **沉淀**：新功能验收通过后，让 Copilot 把走通的路径追加成 `tests/v{版本}.spec.js`，下周它就进回归
4. **回填**：新入口/新坑写进 [skills/entry_map.md](skills/entry_map.md)
5. **发版**：验收报告里的「发版内容（初稿）」人工定稿 → 归档到 `发版记录/发版.md`

## 首次/环境恢复步骤

```powershell
cd regression
npm install                  # 装 @playwright/test
npx playwright install chromium
npm run login                # 弹浏览器 → 企微客户端点确认 → 登录态存 auth/state.json
npx playwright test          # 跑回归
```

- 登录态过期（用例批量因跳登录页失败）→ 重跑 `npm run login`
- 8888 转发由 globalSetup 自动起；单独常驻可跑 `npm run proxy`
- 写链路用例（真实上传/提交）默认跳过：`$env:RUN_WRITE=1; npx playwright test --grep @write`

## 测试环境关键信息

| 项 | 值 |
|---|---|
| 测试环境 | http://10.67.8.183:7777（有"当前为开发环境"水印） |
| 后端 API | 10.67.8.183:8888（前端写死 localhost:8888，需本机转发） |
| 测试项目 | 邓欣羽的测试项目 #6712（SJ202607100001） |
| 递交数据项目 | 千岛湖升级优化项目 #6662（4 条递交记录） |
| 登录 | 企微 OAuth（cas-test.51aes.com） |

## 迁移记录

- 2026-07-14 首批：`D:\project\hermes-agent\AgentGroups\BrowserHarness\agent-workspace\{domain-skills/51pm → skills, acceptance → acceptance}` 与 `D:\project\51PM发版\51PM-Version → 发版记录`，79 个文件逐一 MD5 校验一致。
- 2026-07-14 补迁（全库排查后发现的遗漏）：
  - `AgentGroups/docs/{发版验收流程.md, 能力架构与验收方案说明.md, AI应用落地概念说明.md}` → `docs/`（3 个，MD5 一致）
  - WSL `~/.hermes/skills/browser-harness/references/51pm-*.md` → `skills/references/`（5 个 Hermes 实测沉淀笔记：验收技巧/入口勘察/排期查询，MD5 一致）
  - WSL `acceptance.bak-20260709` 中现仓库已精简掉的 V2.2.3 过程截图 → `acceptance/_bak-20260709-独有文件/`（46 个，归档备查）
- **原目录均未删除**（Hermes/WSL 侧 symlink 仍指向原处，若确认弃用 Hermes 流程可另行清理）。
- 故意不迁（属 Hermes 基础设施，与 51PM 流程本身无关）：harmesAgent 的 config/USER.md、persona、prompts/cron-*（飞书 cron 播报）、scripts/（网关/Chrome/CDP 运维脚本）、BrowserHarness 工具本体。
