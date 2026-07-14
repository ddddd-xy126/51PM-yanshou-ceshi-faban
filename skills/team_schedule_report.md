# 51PM — 团队排期汇报（按部门 + 日期范围拉团队排期，输出"日期→人员"汇报）

> **只读 skill**。整个流程只允许 `js(...)` 读 Vue 数据 + 调 `vue.search()` / 点"查询"按钮这一组动作。**禁止**完工 / 编辑 / 删除 / 保存 / 修改排期 / 任务分段。如果用户在同一会话里追加"顺便把 X 完工"，必须停下来跟用户二次确认，并切到 [checkTask_confirmTask.md](checkTask_confirmTask.md) 处理，**不在本 skill 内做写操作**。

## 适用场景

- "看 Web端开发本周排期"
- "X 部门 X 时间段排期"
- "组员这周在做什么 / 工时多少"

## 参数

| 参数 | 示例 | 说明 |
|---|---|---|
| `env` | `prod` / `test` | 默认正式 `51pm.51aes.com:771`；测试 `10.67.8.183:7777` 排期数据基本为空 |
| `dept_titles` | `["Aes/工程与交付/项目交付/Web端开发"]` | 部门全路径列表（多部门用数组）。**不要硬编码 dept_id**，用 `deptFlatList` 动态查 |
| `start_date` / `end_date` | `2026-04-27` / `2026-05-03` | ISO 周一→周日；用户没说就按今天的 ISO 周 |

## 入口

URL：`/schedule/schedule_table`（拼到 env host）。

**进入页面前必须执行 [README.md → 操作前置规则](README.md#操作前置规则强制) 的 Tab 复用模板**：先 `list_tabs(include_chrome=False)` 找已有 51pm tab，命中就 `switch_tab` + 页内导航到 `/schedule/schedule_table`；不命中才 `new_tab`。

## 步骤

### 1. 取 root vm（schedule 页）

```python
def get_schedule_vm_path():
    """从 form 元素上溯到含 scheduleTableList 的 vm。"""
    return '''
      let v = document.querySelector("form.el-form").__vue__;
      while (v && !v.$data.scheduleTableList) v = v.$parent;
    '''
```

### 2. 用 Vue 直写触发查询（推荐路径）

排期页 vm 的 `$data.form` 字段：
```
form: { limit, page, user_id:[], dept_id:[], hire_type:"", start_date, end_date }
```
- `dept_id` / `user_id` 是**数组**（多选），单部门也要 `[15]`。
- `start_date` / `end_date` 是 `YYYY-MM-DD` 字符串。
- 这个 vm **可能没有 `search()` 方法**，没有时回退点"查询"按钮。

```python
import json, time
from datetime import datetime, timedelta

def default_week():
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    return str(monday), str(monday + timedelta(days=6))

def query_schedule(dept_titles, start_date, end_date):
    payload = json.dumps({"depts": dept_titles, "s": start_date, "e": end_date}, ensure_ascii=False)
    js(f'''(() => {{
      const args = {payload};
      let v = document.querySelector("form.el-form").__vue__;
      while (v && !v.$data.scheduleTableList) v = v.$parent;
      if (!v) return null;
      const ids = args.depts.map(t => {{
        const hit = v.deptFlatList.find(d => (d.title||d.name||d.label) === t);
        return hit ? hit.id : null;
      }}).filter(x => x !== null);
      v.form.dept_id = ids;
      v.form.start_date = args.s;
      v.form.end_date   = args.e;
      v.form.page = 1;
      if (typeof v.search === "function") v.search();
      else {{
        const b = Array.from(document.querySelectorAll("button"))
                      .find(x => x.innerText.trim() === "查询");
        b && b.click();
      }}
      return ids;
    }})()''')
    time.sleep(4)
    return js('''(() => {
      let v = document.querySelector("form.el-form").__vue__;
      while (v && !v.$data.scheduleTableList) v = v.$parent;
      return v.scheduleTableList;
    })()''')
```

### 3. 数据结构（`scheduleTableList`）

⚠️ 这是**对象**，不是数组：

```
{
  table_head: [...],
  table_data: [
    {
      id, nick_name, status,
      day: {
        "YYYY-MM-DD": { is_work_day: bool, list: null | [[task,...], ...] }
      }
    }, ...
  ]
}
```

要点：
- `day[date].list` 是**二维数组**（外层按项目分组，内层是任务），**双层 flatten**。
- `is_work_day=false` 的日期跳过（节假日 / 周末），汇报顶部统一标注一句"X/X、X/X 系统标记为非工作日，无排期"。
- 单部门可能在 `deptFlatList` 出现多条（如 `Aes/...` 与 `其他/Aes/...`），只匹配用户指定的全路径；模糊匹配时优先 `Aes/` 开头。

任务对象字段：
```
name, project_name, status (done/doing/wait/pause/cancel/closed),
standard_hour, task_process, desc, start_date, end_date, user_name, task_id
```

### 4. 汇总成"日期→人员→任务"汇报

```python
from collections import defaultdict
status_zh = {
    "done":"✅已完成", "doing":"🔄进行中", "wait":"⏳未开工",
    "pause":"⏸已暂停", "cancel":"❌已取消", "closed":"🔒已关闭",
}

def build_report(data):
    by_date = defaultdict(lambda: defaultdict(list))
    holidays = []
    for r in data["table_data"]:
        name = r["nick_name"]
        for date, info in r["day"].items():
            if not info.get("is_work_day"):
                holidays.append(date)
                continue
            for grp in (info.get("list") or []):
                for t in grp:
                    by_date[date][name].append(t)
    return by_date, sorted(set(holidays))

def render(by_date, holidays):
    if holidays:
        print(f"⚠️ 非工作日（无排期）：{', '.join(holidays)}\n")
    for date in sorted(by_date):
        print(f"\n## 📅 {date}")
        for name in sorted(by_date[date]):
            ts = by_date[date][name]
            total = sum(t.get("standard_hour", 0) for t in ts)
            print(f"### {name}（{len(ts)} 项 / {total}H）")
            for t in ts:
                tag = status_zh.get(t["status"], t["status"])
                print(f"- {tag} {t['name']}｜{t.get('project_name','')}（进度 {t.get('task_process',0)}%）{t.get('desc','').strip()}")
```

## 验收清单

- [ ] 复用同站 tab，未新开多余 tab
- [ ] 只调 `vue.search()` 或点"查询"按钮，未触发任何写操作
- [ ] 汇报包含 部门名 / 日期范围 / 人员清单 / 每人当日任务和工时合计
- [ ] 非工作日明确标注"无排期"

## 已知坑

1. `scheduleTableList` 是 dict（含 `table_data` / `table_head`），**别 `.slice()`**。
2. `day[date].list` 是二维分组，必须双层 flatten。
3. `dept_id` 字段是数组，单部门也要 `[15]`。
4. 排期页路由是 `/schedule/schedule_table`，不要走 `/task_panel/...`（那是任务列表）。
5. 测试环境 `10.67.8.183:7777` 的排期数据基本为空；本 skill 默认用正式环境。
6. 部门可能在 `deptFlatList` 出现多条同名（不同父路径），按用户给的全路径精确匹配。
