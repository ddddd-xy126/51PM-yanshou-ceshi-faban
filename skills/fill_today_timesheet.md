# 51PM — 查询/查看今日个人排期（只读）

查询某用户在今天的所有排期条目，并提取每条的 任务名称 / 任务描述 / 所属项目 / 任务状态 / 排产工时 / 实际花费。

**这是只读流程**。流程里出现的"修改排期 / 任务分段 / 删除任务"按钮 **绝对不能点**。

## 参数

| 参数 | 示例 | 说明 |
|---|---|---|
| `user_name` | `华中豪` | 排期表左侧的工程师姓名（精确匹配） |
| `dept_path` | `Aes/工程与交付/项目交付/Web端开发` | 部门下拉的完整路径；可用模糊关键字（如 `Web端`）触发搜索 |
| `date` | `2026-04-29` | ISO 日期；表头格式是 `2026-04-29 周三`，表头 class 也带 `date-col-2026-04-29`，今天那列额外有 `today-header` |

## 入口

URL：`http://51pm.51aes.com:771/schedule/schedule_table`

走顶部菜单也可以：找文本 `排期` 的 `<li>`（`y < 60`，顶栏菜单），click。

**进入页面前必须执行 [README.md → 操作前置规则](README.md#操作前置规则强制) 的 Tab 复用模板**：先 `list_tabs(include_chrome=False)` 找已有 51pm tab，命中就 `switch_tab` + 页内导航到 `/schedule/schedule_table`；不命中才 `new_tab`。这是只读 skill，默认复用、不询问用户。

## 步骤

### 1. 选部门

部门下拉位置：`document.querySelector(".el-select")`（视口内 y≈95，第二个 select，宽 ~320）。

更稳的写法：

```js
// 用 placeholder 区分这一行的几个 el-select
const selects = Array.from(document.querySelectorAll(".el-select"))
  .filter(el => el.getBoundingClientRect().y < 120 && el.offsetParent);
// 顺序：[用户][部门][用工形式][项目]
const deptSelect = selects[1];
```

打开下拉 → 在搜索框里输入关键字（如 `Web端`）→ 在 popper 里点中目标项：

```js
const deptInput = deptSelect.querySelector(".el-input__inner");
// click_at_xy 它的中心坐标即可展开
```

popper 出现后用：

```js
const popper = document.querySelector(".el-select-dropdown:not([style*='display: none'])");
const item = Array.from(popper.querySelectorAll(".el-select-dropdown__item"))
  .find(el => el.textContent.trim() === "Aes/工程与交付/项目交付/Web端开发");
```

得到 `item` 的 rect 后 `click_at_xy` 中心。

### 2. 设置日期范围（确保覆盖今天）

两个 `input.el-range-input`，placeholder 是 `开始日期` / `结束日期`，value 形如 `2026 年 04 月 27 日`。默认是当前周。如果今天已经在区间里，**跳过**。

### 3. 点 `查询` 按钮刷新

```js
Array.from(document.querySelectorAll("button"))
  .find(b => b.textContent.trim() === "查询" && b.getBoundingClientRect().y < 200);
```

### 4. 定位 user × today 的单元格

表头：`th.date-col.date-col-${date}`（今天还会带 `today-header`）。

```js
const huaName = Array.from(document.querySelectorAll(".person-name"))
  .find(el => el.textContent.trim() === user_name);
const row = huaName.closest("tr");
const todayHeader = document.querySelector(`.date-col-${date}`);
const colRect = todayHeader.getBoundingClientRect();

// 单元格里的任务条目：.task-item（每个任务一个）
const items = Array.from(row.querySelectorAll(".task-item"))
  .filter(el => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    return cx >= colRect.x && cx <= colRect.x + colRect.width;
  });
```

每个 `.task-item` 内部稳定的子元素：

| 类名 | 内容 |
|---|---|
| `.task-name-text` | 任务名称（如 `平台研发-前端开发、产品方案、项目管理 \| 18H`） |
| `.task-header` | 名称 + 状态色块（`进行中` / `完工` / `搁起` 等） |
| `.task-meta-desc` | 任务描述 |
| `.task-project-name` | 所属项目（如 `自研项目`） |

非项目任务的 `.task-item` 还会带额外 class `task-non-project`。

### 5.（可选）点条目 → 选「查看详情」看完整字段

单击 `.task-item` 中心 → 右侧 portal 弹出菜单 `.menu-item`：

```js
const menu = Array.from(document.querySelectorAll(".menu-item"))
  .find(el => el.textContent.trim() === "查看详情" && el.offsetParent);
```

⚠️ 同一个菜单还有 `修改排期 / 任务分段 / 删除任务`（最后一个 class 是 `.menu-item.delete`），**不要点**。

弹窗 `.el-dialog.task-detail-dialog` 出现，body 里能拿到：

- `任务：<名称> <产出类型>`（产出类型如 `非产出`）
- `商机号: <id>` / `ZYXMID: <id>`
- `任务描述: <描述>`
- `<产出类型>工时<排产工时>`
- `当日实际花费<已确认工时>`
- `花费记录` 列表（无则 `暂无花费记录`）

关闭：`press_key("Escape")` 最稳。

## 已知陷阱

- **只读取 `.task-item`，不要用更外层的 `.task-cell-wrapper / .task-group / .task-list-wrapper`**。它们包同一份内容，会让你以为有 4 个任务。
- 部门下拉的 popper 不在 `.el-select` 内部，是 `body > .el-select-dropdown`。用 `:not([style*='display: none'])` 过滤掉缓存的隐藏 popper。
- 多用户排期时，行高随当日任务数量变化；不要假设 `.task-item` 在固定 y。一律用 `.person-name → closest("tr")` 锚定。
