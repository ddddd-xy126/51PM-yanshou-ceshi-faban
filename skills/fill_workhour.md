# 51PM — 填写工时/花费（写操作，已跑通 2026-07-07）

给某个任务添加一条当日工时（花费）记录。**提交前必须 AskUserQuestion 确认工时数和描述。**

## 入口（唯一已验证路径）

排期表的任务详情弹窗是**只读**的（无添加花费入口）；「我的地盘」也没有填报按钮。
正确入口是**任务列表页的操作列时钟按钮**：

1. 进 `/task_panel/project_task` 或 `/task_panel/project_not_task`（NPT 任务在后者，两 tab 数据互不相通）。
2. 用 Vue 直写筛出目标任务。⚠️ **本页 vm 挂在 `div.main` 上，不是 `form.el-form`**（`document.querySelector("form.el-form")` 拿不到）：

```js
let v = document.querySelector("div.main").__vue__;
v.form.assigned_to = 475;      // 用户 id，从排期页 vue.userList 查（如 邓欣羽=475）
v.form.status = "doing";
v.form.start_date = "2026-07-06"; v.form.end_date = "2026-07-12";
v.form.date_type = "task"; v.form.page = 1; v.form.limit = 50;
v.search();
```

⚠️ 日期筛选按任务的起止日期**区间相交**匹配；单日 `start=end=今天` 会漏掉跨天任务段（如周四-周五的 16H 段），**用整周范围再自己挑**。

3. 点目标行操作列的 `button.workHour`（icon `el-icon-time`）。操作按钮必须从 `.el-table__fixed-right .el-table__body tbody tr` 里取，行序与主体 tbody 一致。

## 弹窗流程（两层）

1. 第一层：工时记录列表弹窗（`.el-dialog`，标题=任务名），显示已有花费记录。点 **「填写工时」** 按钮。
2. 第二层：`.el-dialog.workhour-dialog`「添加工时」表单：
   - 花费人：默认当前登录人，已填
   - 花费日期：默认今天，已填
   - **花费总计**：数字步进器，默认 8。⚠️ 定位方式：`inputs.find(i => i.value === "8")` 不稳（提交过就不是8），更稳的是取 `.el-input-number input` 
   - **当日完成工作**（必填）：第一个 `textarea`
   - 过程验收人 / 明日工作计划 / 上传截图：可选
3. 填值必须用 native setter + input 事件，否则 v-model 不同步：

```js
const setVal = (el, val) => {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
  el.dispatchEvent(new Event("input", {bubbles: true}));
  el.dispatchEvent(new Event("change", {bubbles: true}));
};
```

4. **停：AskUserQuestion 确认后**再点 `立即创建`。
5. 验证：表单弹窗关闭，第一层列表出现新记录（日期/花费/花费人/描述/确认状态=未确认）。没有 el-message toast 也算成功，以列表记录为准。

## 已知陷阱

- 排期页任务详情弹窗（`.task-detail-dialog`）能看「当日实际花费」但**不能填**，别在那里找入口。
- 详情弹窗内容异步加载，点开后要 sleep 2-3s 再读。
- 提交成功后记录状态是「未确认」，确认是另一个流程（通常由验收人/上级做）。
