# PM 审批递交申请（转化为递交）【写】

> 一句话：PM 在我的信箱审批 QA/TB 提交的递交申请，通过后「转化为递交」填表单（含 WDPAPI 版本下拉）。典型 AI 复用场景：「PM 审批递交申请、验证 WDPAPI 版本下拉」。
>
> ⚠️ **写操作 + 角色门禁**：「通过审批/驳回」按钮 `systemRole!=='PM'` 时 disabled；非必要不提交。

## 参数

| 参数        | 示例            | 说明                                          |
| ----------- | --------------- | --------------------------------------------- |
| `env`       | `test` / `prod` | 测试（默认）/ 正式；写操作没说就 ask          |
| `apply`     | `某递交申请`    | 目标申请行                                    |
| `WDPAPI`    | `API2.3.x`      | 转化表单版本下拉（17 项，含 API2.3.x + 无）   |

## 入口

- **入口**：我的地盘 → 我的信箱 →「审批递交申请(PM)」tab → 行尾「通过审批」→「转化为递交」表单
- **等待锚点**：`wait_for_selector('.el-table', 15000)`
- **进站**：⚠️ 我的地盘子页直接 URL 会重定向回 main，**点左侧菜单**进入

## 操作步骤（真实 UI）

> 文字版流程，先建立整体认知；自动化执行看下方「步骤」。

1. ⚠️ 我的地盘子页直接 URL 会重定向回 main，**点左侧菜单**进入「我的信箱」
2. 切「审批递交申请(PM)」tab
3. 行尾「通过审批」→ 打开「转化为递交」表单
4. 「WDPAPI」下拉共 17 项，含 API2.1.x / API2.2.x / **API2.3.x**（+「无」兜底项，V2.2.8 补充）
5. 补齐表单后提交（写操作，非必要不提交）

## 步骤

### 1.（UI 复现）进信箱 + 打开转化表单（仅查看不提交）

```js
// ⚠️ 必须点左侧菜单，直接 URL 重定向回 main
Array.from(document.querySelectorAll(".el-menu-item, .side-menu a, span"))
  .find(el => el.offsetParent && el.textContent.trim() === "我的信箱")?.click();
// 切 tab
Array.from(document.querySelectorAll(".el-tabs__item"))
  .find(el => el.textContent.includes("审批递交申请(PM)"))?.click();
// 非 PM 账号按钮 disabled → 用 Vue 直调 approvedApply(row) 打开表单仅查看不提交
```

## 🚨 防手滑（写操作强制）

- 角色门禁：非 PM 账号「通过审批/驳回」disabled → 用 Vue 直调 `approvedApply(row)` **仅查看不提交**
- 提交前把表单字段（含 WDPAPI 版本）给用户 AskUserQuestion 确认
- 小视口(<1920)下左侧菜单不渲染 → 用 ≥1920 视口

## 可直调接口

- `project_publish/get_normal_const`：返回 WDPAPI 枚举（含 `API2.3.x`），code 0（`j.data`）

## 读数 / 断言锚点

- WDPAPI 下拉 17 项：API2.1.x / API2.2.x / API2.3.x（+「无」）
- 门禁条件：`systemRole!=='PM'` → 按钮 disabled

## 已知坑

- ⚠️ 门禁：「通过审批/驳回」按钮 disabled 条件 `systemRole!=='PM'`（另有硬编码白名单彰中豪）；非 PM 账号验表单用 Vue 直调 `approvedApply(row)` 打开表单仅查看不提交
- ⚠️ 小视口(<1920)下左侧菜单不渲染
- ⚠️ 我的地盘子页直接 URL 重定向回 main（步骤 1）

---
_来源：V2.2.6 / V2.2.8 验收轮 ｜ 最后验证：2026-07-23_
