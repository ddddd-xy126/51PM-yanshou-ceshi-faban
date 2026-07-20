# 工作台 UGA 入口【写/跳转】

> 一句话：从「我的工作台」下拉进 UGA，携登录态 token 免登跳转到 UGA 系统（正式/hzh/wsm 三环境）。

- **入口**：顶栏「我的工作台」下拉 → 「UGA」级联项(悬停) → 正式 / hzh / wsm
- **适用/触发**：从 51PM 免登进入 UGA 系统

## 操作步骤（真实 UI）

1. 展开顶栏「我的工作台」下拉，确认「UGA」级联项存在（位于组群配置与版本控制之间）
2. hover 展开二级级联，出现 3 个环境入口（正式 / hzh / wsm）
3. 点「正式」→ 触发 `window.open('http://10.2.13.121/entry?t=<oauthToken>&uid=&from=51pm')`，携 token 免二次登录

## 已知坑

- ⚠️ token 以**明文 query** 传递（安全待评估，建议改一次性 code 交换）
- ⚠️ 集成浏览器拦弹窗，验证用 `window.open` spy
- ⚠️ 菜单展开需 JS 派发 mouseenter（`.wb-trigger__text` → `.uga-cascade-label`）

---
_来源：V2.2.8 验收轮 ｜ 最后验证：2026-07-18_
