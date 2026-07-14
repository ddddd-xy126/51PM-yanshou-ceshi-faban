# 51PM — 查看本周组员任务并逐个完工

按 `部门 + 任务状态 + 自然周时间` 筛任务列表，列给用户看，等用户确认后**只点列表操作栏第一个图标"完工"**。

⚠️ **写操作 skill**。任何点击前必须先 AskUserQuestion 让用户挑编号。**禁止点**编辑 / 工时 / 删除。

## 参数

| 参数 | 示例 | 说明 |
|---|---|---|
| `env` | `test` / `prod` | 环境：测试 `10.67.8.183:7777` / 正式 `51pm.51aes.com:771`。**用户没说就 ask**。 |
| `dept_path` | `Aes/工程与交付/项目交付/Web端开发` | 部门完整路径；下拉支持模糊搜索（输 `Web端` 即可定位）。 |
| `status` | `进行中` | 任务状态。允许值：`未开工 / 进行中 / 已完成 / 已暂停 / 已取消 / 已关闭`。**只有进行中的任务"完工"按钮才可点**（未开工 → disabled）。 |
| `week_start` / `week_end` | `2026-04-27` / `2026-05-03` | 自然周一到周日（ISO 周）。今天的本周可以从 `new Date()` 算。 |
| `task_kind` | `项目任务` / `非项目任务` / `全部` | 表格上方的两个 tab。**两边数据不互通**：项目任务是排期内、挂在项目下的；非项目任务是 NPT（培训/会议/支持等）。用户没说时按 `全部` 处理：先项目任务跑一遍，再切到非项目任务再跑一遍，最后合并报告（编号统一带前缀 `P-` / `N-` 区分）。 |

## 入口

路由：`/task_panel/project_task`（拼到 env host 上）。
也可走顶部一级菜单 `任务`。

**进入页面前必须执行 [README.md → 操作前置规则](README.md#操作前置规则强制) 的 Tab 复用模板**：先 `list_tabs(include_chrome=False)` 检查是否已有 `51pm.51aes.com` / `10.67.8.183` 开头的 tab，命中就 `switch_tab` + 页内导航到 `/task_panel/project_task`；不命中才 `new_tab`。**禁止首选 `new_tab`**。

## 步骤

### 0. 切 tab（项目任务 / 非项目任务）

表格容器顶部有一组 tab（位置 y≈68，水平居中）：

```
[项目任务]   非项目任务
```

激活态 class 含 `is-active`（蓝色下划线）。两 tab 用同一份筛选 + 同一份表格组件，但接口不同 → **切 tab 后筛选会保留，但列表必须重新点 `查询` 才会刷新**。

定位 + 点击：

```js
const tabs = Array.from(document.querySelectorAll(".el-tabs__item, [role='tab']"))
  .filter(el => el.offsetParent && /^(项目任务|非项目任务)$/.test(el.textContent.trim()));
// 兜底：tab 不是 el-tabs 时（有的版本是普通 span）
if (tabs.length === 0) {
  Array.from(document.querySelectorAll("span, div"))
    .filter(el => el.offsetParent
      && /^(项目任务|非项目任务)$/.test(el.textContent.trim())
      && el.getBoundingClientRect().y < 100);
}
```

点目标 tab → 等 `is-active` 转移到它身上 → 重新执行步骤 1~3。**如果 `task_kind = 全部`，先做项目任务，结果存好，再切到非项目任务再做一遍**。

非项目任务的列结构和项目任务略有差异（`项目名称` 可能为空 / 列名变 `非项目名称`），读取时按表头 `<th>` 文本动态 build 列序，不要硬编码 idx。

### 1. 设置筛选

筛选区在表格上方两行：

**第 1 行（y≈110）**：`任务状态` / `指派给` / `部门` / `任务名称` / `项目` / `产出类型`
**第 2 行（y≈157）**：`日期类型`（默认 `任务时间`）/ `开始时间` / `结束时间` / `查询` / `重置`

每个 `el-input__inner` 用 `placeholder` 区分，**但项目任务 / 非项目任务两个 tab placeholder 不一样**，靠 `placeholder` 定位会在切 tab 时悄悄失败（select 没打开 → `pick_option` 返回 null → 等同于无筛选，结果会拉回全表）。

**最稳的做法：按 `.el-form-item__label` 的中文文本定位**，两个 tab 通用：

```js
function clickInputByLabel(labelText) {
  const items = Array.from(document.querySelectorAll(".el-form-item"))
    .filter(it => it.offsetParent && it.getBoundingClientRect().y < 250);
  const it = items.find(x => {
    const l = x.querySelector(".el-form-item__label");
    return l && l.textContent.trim() === labelText;
  });
  if (!it) return null;
  const inp = it.querySelector("input");
  const r = inp.getBoundingClientRect();
  return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)};
}
```

参考 placeholder（仅供调试，不要拿来定位）：

| 字段 / label | 项目任务 placeholder | 非项目任务 placeholder |
|---|---|---|
| 任务状态 | `请选择任务状态` | `请输入关键词` |
| 指派给 | `请选择` | `请输入人员名称` |
| 部门 | `请选择部门` | `请输入部门名称` |
| 任务名称 | `请输入任务名称` | `请输入任务名称` |
| 项目 / 非项目 | `请选择项目` | `请输入非项目名称`（label 也变成 `非项目`） |
| 产出类型 | `请选择产出类型` | `请选择产出类型` |
| 日期类型 | `请选择日期类型` | `请选择日期类型` |
| 开始/结束时间 | `选择日期` | `选择日期` |

非项目任务 tab 的"指派给"是 filterable select：先 `clickInputByLabel("指派给")` → `type_text("华中豪")` → 再在展开的 popper 里 `.el-select-dropdown__item` click 选中。直接 click 后 `pick_option` 不输入关键词的话候选可能不展示（或只展示常用的几个）。

**部门**：点输入框 → `type_text("Web端")` 触发模糊搜索 → 在当前展开的 popper 里点 `Aes/工程与交付/项目交付/Web端开发` 选项。

**状态**：点输入框 → 在 popper 里点 `进行中`（注意空白处也是该 select 的下拉位置，popper 在 `body` 下）。

**日期**：直接给 `<input>` 设 value 不同步 v-model，必须走 Vue：

```js
const dateInputs = Array.from(document.querySelectorAll("input.el-input__inner"))
  .filter(el => el.placeholder === "选择日期" && el.offsetParent);
function findDatePicker(el) {
  let n = el;
  while (n) {
    if (n.__vue__) {
      let v = n.__vue__;
      while (v) {
        if (v.$options?._componentTag === "el-date-picker") return v;
        v = v.$parent;
      }
    }
    n = n.parentElement;
  }
}
findDatePicker(dateInputs[0]).$emit("input", new Date(week_start));
findDatePicker(dateInputs[1]).$emit("input", new Date(week_end));
```

### 2. 点 `查询`

```js
Array.from(document.querySelectorAll("button"))
  .find(b => b.textContent.trim() === "查询" && b.offsetParent && b.getBoundingClientRect().y < 250);
```

页脚 `.el-pagination__total` 会显示 `共 N 条`，作为 sanity check。

### 3. 读取列表

**坑**：`el-table` 把固定左/右列另外渲染一份 `tbody`，直接全选会拿到重复行；每个单元格的 `textContent` 也包含一份悬停 tooltip 副本。两个去重方法：

```js
const mainBody = document.querySelector(".el-table .el-table__body-wrapper .el-table__body tbody");
const rows = Array.from(mainBody.querySelectorAll("tr"));
const dedupe = s => {
  const h = s.length / 2;
  return s.length > 1 && s.slice(0, h) === s.slice(h) ? s.slice(0, h) : s;
};
```

**别按 idx 硬读**（项目任务 / 非项目任务两个 tab 表头不同，且列可能后续调整）。按表头 `<th>` 文本动态映射：

```js
const thead = document.querySelector(".el-table .el-table__header-wrapper thead");
const headers = Array.from(thead.querySelectorAll("th .cell")).map(c => dedupe(c.textContent.trim()));
const col = name => headers.indexOf(name);
// row.cells[col("任务名称")] 等
```

参考列序（项目任务 tab，截至本次调研）：

| idx | 列 |
|---|---|
| 0 | 任务名称 |
| 1 | 需求名称 |
| 2 | 项目名称 |
| 3 | 状态 |
| 4 | 指派给 |
| 5 | 开始时间 |
| 6 | 结束时间 |
| 7 | 任务描述（按钮：`查看描述`） |
| 8 | 任务日报 |
| 9 | 花费工时 |
| 10 | 审核人 |
| 11 | 产出类型 |
| 12 | 标准工时 |
| 13 | 非产出工时 |
| 14 | 产出工时 |
| 15 | 标准剩余工时 |
| 16 | 进度 |

**操作列**渲染在固定右侧 `tbody`：

```js
const actionRows = document.querySelectorAll(".el-table .el-table__fixed-right .el-table__body tbody tr");
```

### 4. 给用户编号 + 汇报

每条任务给一个**自己编的**短编号 — 项目任务用 `P-01 / P-02 …`，非项目任务用 `N-01 / N-02 …`（不是系统的任务 ID），列出 `任务名称 / 项目 / 指派给 / 开始-结束 / 产出类型 / 工时 / 完工按钮是否可点`。`task_kind = 全部` 时把两段拼一起呈现，标题分隔清楚。

**用 AskUserQuestion 让用户挑要完工的编号**（多选）。`同意全部` / `部分编号` / `跳过` 都要兜住。

### 5. 逐个点"完工"（写操作）

> 🚨🚨🚨 **重大事故教训（2026-05-06，正式环境）** 🚨🚨🚨
>
> **绝对不允许在一次循环里连续点击多条任务的完工按钮。** 每点一条任务后：
> 1. **必须 wait 至少 1.5s** 让后端响应、行重排完成。
> 2. **必须重新点"查询"刷新表格**，让"已完工"的行从"进行中"列表里消失。
> 3. **必须重新读取整张表格**，按 **任务名称** 重新定位下一条要点的行。
> 4. **绝对不能** 用上一轮缓存的 `(x, y)` 坐标点第二条 —— 上一行消失后，下面的行会向上移动一个行高，旧坐标会落在另一条**完全不该动的任务**身上，导致误完工。
>
> **真实事故**：用户让完工 3 条任务，agent 一次性读出 3 个坐标 (1756, 309) / (1756, 380) / (1756, 451) 然后顺序点击。第 1 次点击成功后行重排，第 2、3 次点击落到了错位的行上 —— 中间一条没完工，**另一条完全不在目标里的任务被误标完成**。事后用户必须人工去回滚。
>
> **必须遵守的循环写法**：
>
> ```python
> for target_name in target_names:
>     # 每次都重新读表格，按名字定位
>     pos = js(f'''
>       (function(){{
>         var dedupe = s => {{ var h=s.length/2; return s.length>1 && s.slice(0,h)===s.slice(h) ? s.slice(0,h) : s; }};
>         var body = document.querySelector(".el-table .el-table__body-wrapper .el-table__body tbody");
>         var rows = body ? Array.from(body.querySelectorAll("tr")).filter(r => r.offsetParent) : [];
>         for (var i=0; i<rows.length; i++) {{
>           var nameCell = rows[i].querySelector("td:first-child .cell");
>           if (!nameCell) continue;
>           if (dedupe(nameCell.textContent.trim()) !== {json.dumps(target_name)}) continue;
>           // 操作列在 .el-table__fixed-right 里 —— 别用 row.querySelector("td:last-child")，那是主 tbody 最后一列，不是固定右侧的操作列
>           var fixedRight = document.querySelector(".el-table__fixed-right .el-table__body tbody");
>           var fixedRow = fixedRight ? fixedRight.querySelectorAll("tr")[i] : null;
>           var btn = fixedRow ? fixedRow.querySelector("button.finish") : null;
>           if (!btn || btn.disabled || btn.classList.contains("is-disabled")) return null;
>           var r = btn.getBoundingClientRect();
>           return {{x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}};
>         }}
>         return null;
>       }})()
>     ''')
>     if not pos:
>         print(f'未找到 {target_name}（可能已完工或被筛掉）')
>         continue
>     click_at_xy(pos['x'], pos['y'])
>     wait(1.5)
>     # 处理可能的二次确认弹框（见下文）
>     ...
>     wait(1)
>     # ⚠️ 关键：重新点"查询"让表格刷新，下次循环重新定位
>     click_query_button()
>     wait(2.5)
> ```
>
> **不要** 一次性把所有目标的坐标读出来再循环点 —— 这是事故根源。



操作列的 4 个按钮（从左到右）：

| 顺序 | 类名特征 | icon | 含义 | agent 能点？ |
|---|---|---|---|---|
| 1 | `button.finish` | `el-icon-document-checked` | **完工** | ✅ 仅在用户确认后 |
| 2 | (无特定 cls) | `el-icon-edit-outline` | 编辑 | ❌ 禁 |
| 3 | `button.workHour` | `el-icon-time` | 工时 | ❌ 禁 |
| 4 | (无特定 cls) | `el-icon-delete` | 删除 | ❌ 禁 |

定位方式（行内）：

```js
const finishBtn = row.querySelector("button.finish");
// 必须先检查
if (finishBtn.disabled || finishBtn.classList.contains("is-disabled")) {
  // 未开工状态下完工按钮禁用 — 报告给用户，不要点
}
```

点击：拿 rect 算中心 → `click_at_xy`。

**点完每条 → 等弹出的二次确认**：可能是 `el-message-box`（`确定` / `取消`）或后端直接更新。预期反馈：
- 列表里该行状态从 `进行中` 变成 `完成`，进度变 `100%`。
- 顶部出现 `el-message` toast。

如果出二次确认弹框，**再次 `AskUserQuestion`** 让用户决定是否真的"确定"，**不要 agent 自己点确定**。

### 6. 校验

完成所有点击后，点 `查询` 重新拉一次列表，比对 `进行中` 数量减少了对应数量，并截图给用户确认。

## 已知陷阱

- **项目任务 / 非项目任务两个 tab 的数据完全独立**。用户问"所有进行中的任务" / "本周任务"等不限定 tab 的问题，必须两个 tab 都跑一遍再合并；只跑一边会漏。tab 切换不会重置筛选，但列表不会自动刷新 — 切完必须重点 `查询`。
- **未开工任务的"完工"按钮 `is-disabled`、`disabled=true`**。不能直接对未开工的批量完工 — 它们必须先在前端被推到 `进行中`。
- **状态选项里的 "已完成" 列表显示成 "完成"**：表头单元格里看到的 `状态` 文本是 `完成`，但 `el-select` 选项里写 `已完成`。匹配时只用过滤选项；读取行用 `完成` / `进行中` / `未开工`。
- **共 N 条 = 0** 不一定意味着没数据：先确认环境对（测试 / 正式数据互不相通）；其次确认日期范围（页面默认无范围 → 后端返回当前日历周还是全部，不同环境不一样）。
- **Vue 实例查找**：直接 `el.__vue__` 经常是底层 `el-input`，要循环 `$parent` 找到目标 `_componentTag`（`el-date-picker` / `el-select`）。
- **type_text 在 el-select 里触发的是 filterable 搜索**：必须先 `click_at_xy` 让那个 input focus 起来再 type，否则键击会落到上一个 focus 的元素上。
