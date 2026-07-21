# 工作台 UGA 入口【写/跳转】

> 一句话：从「我的工作台」下拉进 UGA，携登录态 token 免登跳转到 UGA 系统（正式/hzh/wsm 三环境）。典型 AI 复用场景：「从 51PM 免登进入 UGA」。
>
> ⚠️ **跳转会携明文 token**：确认目标环境后再点，勿在日志/截图里泄露 token。

## 参数

| 参数    | 示例                  | 说明                                   |
| ------- | --------------------- | -------------------------------------- |
| `env`   | `test` / `prod`       | 51PM 端环境                            |
| `target`| `正式` / `hzh` / `wsm`| UGA 目标环境（三选一）                 |

## 入口

- **入口**：顶栏「我的工作台」下拉 →「UGA」级联项(悬停) → 正式 / hzh / wsm
- **等待锚点**：`wait_for_selector('.wb-trigger__text', 15000)`
- **进站**：先按 [../README.md](../README.md) Tab 复用，禁止首选 new_tab

## 操作步骤（真实 UI）

> 文字版流程，先建立整体认知；自动化执行看下方「步骤」。

1. 展开顶栏「我的工作台」下拉，确认「UGA」级联项存在（位于组群配置与版本控制之间）
2. hover 展开二级级联，出现 3 个环境入口（正式 / hzh / wsm）
3. 点「正式」→ 触发 `window.open('http://10.2.13.121/entry?t=<oauthToken>&uid=&from=51pm')`，携 token 免二次登录

## 步骤

### 1.（UI 复现）展开级联菜单并跳转

```js
// ⚠️ 菜单展开需 JS 派发 mouseenter
const trig = document.querySelector(".wb-trigger__text");
trig?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
const uga = document.querySelector(".uga-cascade-label");
uga?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
// 出现 3 环境入口后点目标；集成浏览器拦弹窗，验证用 window.open spy
Array.from(document.querySelectorAll(".uga-cascade-label ~ * a, .cascade-item"))
  .find(el => el.offsetParent && el.textContent.trim() === "正式")?.click();
```

## 🚨 防手滑（写/跳转）

- token 以明文 query 传递 → 勿把跳转 URL 打进日志/截图/记忆
- 确认目标环境（正式/hzh/wsm）后再点，别误跳生产
- 集成浏览器会拦弹窗，用 `window.open` spy 验证而非真跳

## 读数 / 断言锚点

- 菜单触发：`.wb-trigger__text` → `.uga-cascade-label`
- 跳转断言：`window.open` 被调用且 URL 形如 `http://10.2.13.121/entry?t=<token>&uid=&from=51pm`

## 已知坑

- ⚠️ token 以**明文 query** 传递（安全待评估，建议改一次性 code 交换）
- ⚠️ 集成浏览器拦弹窗，验证用 `window.open` spy
- ⚠️ 菜单展开需 JS 派发 mouseenter（`.wb-trigger__text` → `.uga-cascade-label`）

---
_来源：V2.2.8 验收轮 ｜ 最后验证：2026-07-18_
