# QA 递交（递交状态自动判定）【写】

> 一句话：在递交列表对一条记录发起 QA 递交，弹窗打开时按递交时间自动预选递交状态（提前/正常/延期）。典型 AI 复用场景：「QA 角色递交测试、验证状态自动判定」。
>
> ⚠️ **写操作 + 白名单门禁**：`testListRooters` 白名单外账号看不到「QA递交」按钮；非必要不提交。

## 参数

| 参数        | 示例            | 说明                                          |
| ----------- | --------------- | --------------------------------------------- |
| `env`       | `test` / `prod` | 测试（默认）/ 正式；写操作没说就 ask          |
| `record`    | `某递交记录`    | 目标递交行（须在白名单账号下才有按钮）        |
| `状态`      | 自动预选        | 早于要求≥1天→提前；当天→正常；晚→需手动延期    |

## 入口

- **入口**：递交 → 递交列表行「QA递交」→ 项目递交弹窗「项目递交(QA)」tab
- **路由**：`/OPStestList/OPStestList_list`（实测）
- **等待锚点**：`wait_for_selector('.el-table', 15000)`
- **进站**：先按 [../README.md](../README.md) Tab 复用，禁止首选 new_tab

## 操作步骤（真实 UI）

> 文字版流程，先建立整体认知；自动化执行看下方「步骤」。

1. 递交列表找到可 QA 递交的记录（⚠️「QA递交/编辑」按钮由用户名白名单 `testListRooters` 控制可见性，非 QA 角色不显示）
2. 点「QA递交」打开项目递交弹窗，切「项目递交(QA)」tab
3. 弹窗打开时**自动预选**递交状态：早于要求时间 ≥1 天 → 提前递交；当天 → 正常递交；晚于 → **不自动选**延期（需手动）
4. 补齐表单后提交（写操作，非必要不提交）

## 步骤

### 1.（UI 复现）打开 QA 递交表单（仅查看不提交）

```js
// 白名单外账号无按钮 → 用 Vue 直调打开表单仅查看（不提交）
// 找到目标行的「QA递交」按钮（在白名单账号下）
Array.from(document.querySelectorAll("button, a"))
  .find(el => el.offsetParent && el.textContent.trim() === "QA递交")?.click();
// 切「项目递交(QA)」tab；弹窗打开即按递交时间自动预选状态
Array.from(document.querySelectorAll(".el-dialog .el-tabs__item"))
  .find(el => el.textContent.includes("项目递交(QA)"))?.click();
```

## 🚨 防手滑（写操作强制）

- 白名单 `testListRooters` 外账号（如邓欣羽）：用 Vue 直调打开表单**仅查看不提交**
- 提交前把递交状态 + 表单字段给用户 AskUserQuestion 确认
- 日期筛选走 vm `form` + `searchData()`（fill 不触发），列表默认只筛今天需放宽

## 可直调接口

- `project_publish/get_normal_const`：提供递交状态/WDPAPI 等枚举（`j.data`）

## 读数 / 断言锚点

- 状态自动判定：早于要求≥1天→提前；当天→正常；晚→不自动选（需手动延期）
- 门禁：`testListRooters` 白名单控制按钮可见性

## 已知坑

- ⚠️ 白名单门禁 `testListRooters`：邓欣羽账号不在名单，造数据/验表单用 Vue 直调打开表单仅查看不提交
- ⚠️ 递交列表默认只筛今天，日期筛选走 vm `form` + `searchData()`（fill 不触发）

---
_来源：V2.2.6 验收轮 ｜ 最后验证：2026-07-15_
