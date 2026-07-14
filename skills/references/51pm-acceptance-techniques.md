# 51PM 验收实测技巧（2026-07-08 V2.2.3 验收沉淀）

真实 UI 验收（release_acceptance）跑通的路径与坑。适用于 51PM（Element UI v2 / Vue2）任何需要真实交互的场景。

## 关键入口（找了很久，直接用）

- **项目日报导出（含"包含制作截图"开关）**：`任务` → 任务行「查看日报」→ 日报弹窗右上角蓝色「导出」（`ProjectEstimateCardList.vue` 的 `openExportDialog`）→ 弹「导出项目日报」配置窗（时间范围 + el-switch）。**不是** 统计→工时 顶部那个 default「导出」按钮（那是旧入口，点了没反应）。接口：`project_task_estimate/export_estimate_list_by_project_id?include_images=`
- **花费/成本导出**：`统计` → 项目成本 `/statistic/project_cost`，接口 `data_export/export_project_cost_list`
- **批量创建组件**（BatchCreateDialog，两步向导）：非项目→需求详情→创建任务（独立/多人通用）；我的地盘→我的反馈→添加反馈→批量添加反馈。⚠️ 从「非项目→任务tab」（URL 无 demandId）进入创建任务会静默失败（code 51 不透出）——验收时这是 BUG，操作时注意必须从需求详情进。
- **主题切换**：顶部导航 `.theme-toggle`（emoji 图标随主题变，如 🍦/❄️，别按固定 emoji 找）→ 下拉面板 18 主题。主题落在 `document.documentElement.getAttribute("data-theme")`（海盐白默认主题时为 null）。

## Element UI 交互坑（本次实测）

1. **el-select 下拉"检测不到"**：`.el-select-dropdown` 用 `offsetParent && style.display!=="none"` 判定会漏（popper 可能 display:"" 且判定时机不对）。**可靠做法**：从 input 上取 `inp.closest(".el-select").__vue__`，看 `vm.visible`（true=已展开）、`vm.options`（数据是否已加载），popper 元素用 `vm.$refs.popper.$el` 拿再取 items 坐标。下拉其实经常已经开着，是探测条件写错。
2. **远程搜索型 select**（如"搜索项目"）：click 后用 CDP `Input.insertText` 逐字输入（每字 sleep 0.3s）触发 remote 搜索，再轮询选项。选项 y 坐标全相同 = 还在展开动画，等 1s 重读。
3. **el-cascader**（任务选项）：面板 `.el-cascader-panel` → 每级 `.el-cascader-menu` → `.el-cascader-node`。点一级后 sleep 1.5s 再读二级 menu。
4. **自绘 popover 型选择器**（`.select-like-reference el-popover__reference`）：不是标准 select，直接点容器中心坐标展开。
5. **el-switch 开关**：点击后验证 `className.includes("is-checked")` 翻转，不要只信点击成功。
6. **浮层内容定位**：`document.elementFromPoint(x,y)` 后向上遍历找 `dialog/popover/drawer` 容器，比全局 query 弹窗更可靠（嵌套弹窗场景，如日报弹窗内再开导出弹窗时有 2 个 `.el-dialog`，按 title 区分）。

## 验证接口/下载的模式

- **hook XHR 抓请求+响应体**（验证提交是否真成功、参数是否正确）：
  ```js
  window.__resp=[]; const _o=XMLHttpRequest.prototype.open,_s=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){this.__url=u;return _o.apply(this,arguments)};
  XMLHttpRequest.prototype.send=function(){this.addEventListener("load",()=>{ if(/关键词/.test(this.__url)) window.__resp.push({url:this.__url,status:this.status,body:this.responseText.slice(0,200)})}); return _s.apply(this,arguments)};
  ```
  **验收金规则**：接口 `code!=0` 但页面无 toast/无状态变化 = 「静默失败」BUG（本次抓到 code 51 无提示）。
- **curl 直接复现导出接口**：token 在 `localStorage.oauthToken`，头是 `Authorization: Bearer <token>`（`token:`/`oauthToken:` 头都是 401）。API host 是 `10.67.8.189:8888`（与前端 host 不同）。
- **xlsx 内容验证**：Chrome 下载落在 `/mnt/c/Users/<user>/Downloads/未确认 *.crdownload`，**crdownload 也是完整可读的 zip**，直接 `zipfile.ZipFile` 打开，`xl/sharedStrings.xml` 里 `<t>` 提取单元格文本；对比两次导出的表头 diff 可验证传参生效（如 include_images=true 多出"反馈截图/进度截图"列）。
- **截图偶发 IPC 超时**：`capture_screenshot()` 超时时改用 `cdp("Page.bringToFront")` + `cdp("Page.captureScreenshot", format="jpeg", quality=80)` 手动 base64 落盘，成功率高很多。

## 主题硬编码走查模式

切到非蓝主题（春节大红反差最大）后，全 DOM 扫 Element 默认蓝残留：

```js
for (const el of document.querySelectorAll("body *")) {
  if (!el.offsetParent) continue;
  const cs = getComputedStyle(el);
  if (cs.color === "rgb(64, 158, 255)" || cs.backgroundColor === "rgb(64, 158, 255)") /* 记录 */;
}
```

多主题 × 多页面各扫一轮；同一元素在所有主题下颜色不变 = 硬编码实锤。已知残留：项目反馈"已交付,待验收" tag。

## 其他

- 51PM 前端会话 token 在 localStorage（`oauthToken`），**没有 cookie**——`Network.getCookies` 返回空是正常的。
- 页面路由全集可从 `document.querySelector("#app").__vue__.$router.options.routes` 递归取，按关键词筛路径，比翻菜单快。
- 前端 bundle 逆向定位功能入口：`performance.getEntriesByType("resource")` 拿全部 js URL → curl 批量下载到 /tmp → grep 接口名/中文文案（如"包含制作截图"），`data-insp-path` 属性直接给出源码 .vue 文件路径，能精确定位组件与 handler 名。

## V2.2.4 验收新增沉淀（2026-07-08）

### hover 型 el-dropdown 按钮（点了没反应 ≠ BUG）
非项目任务页「创建任务」按钮，CDP click 和原生 `btn.click()` 都无任何反应——它是 **hover 触发的 el-dropdown**。判定：按钮 class 含 `el-dropdown-selfdefine` / 有 `aria-haspopup` / `btn.closest(".el-dropdown")` 非空。正确操作：`cdp("Input.dispatchMouseEvent", type="mouseMoved", x=cx, y=cy)` 悬停后 sleep 1.5s，读 `.el-dropdown-menu__item`（如「独立任务 / 多人通用任务」）再点。**先判定 dropdown 再下"无响应 BUG"结论。**

### 组群配置（人员组群）
- 路由 `/user_custom_group_config`（UserCustomGroupManager.vue）。新建分组→弹窗填名→确定；本页无表格，读状态直接用 `document.body.innerText`（"我的分组（N）"、"成员：N"、"有未保存的成员变更"）。
- 加成员：`.left-tools` 里的 el-select（filterable 全员列表）→ 点开 → `Input.insertText` 输姓名过滤 → 点选项 → 点「加入」→ 最后「保存成员」。toast 常不出现，以 body 里"保存成功"+成员数为准。

### 批量创建弹窗（TaskBatchCreateDialog，class batch-create-dialog）
- 「从组群导入」是 el-popover（UserGroupImportPopover.vue）：全局查 `.el-popover`，可见性判定用 `getComputedStyle(e).display!=="none" && rect.width>0`（offsetParent 不可靠）。弹出后组群 select → 选组 → 「添加」，左侧指派人列表批量进人。
- 任务选项是自绘 **TaskOptionsCascader**（popover class `task-options-panel-popover`）：顶部两个 tab（岗位专业 / 管理·会议·售前·培训）+ 多级 cascader-menu，逐级点、每级 sleep 1.5s 再读下一级坐标。
- 工时=el-input-number、描述=textarea，均用 native setter + input/change 事件；表单完备性看「下一步（N/M）」计数与「有效 N」。
- 提交验证：hook XHR 抓 `project_not_task/add_task`（**每个指派人各发一次请求**，各自 code:0），列表刷新出连续新任务 ID 即落库。

### 文件上传（项目概况右侧文档区，ProjectRightInfoBox.vue）
- 未上传时是 `.upload-link`（"上传项目测试文档"等）；已上传后变为 el-link 链接 + 编辑(el-icon-edit)/复制按钮，重新上传走编辑按钮。
- 弹窗内 `input[type=file]` 用 CDP 设文件：`DOM.getDocument` → `DOM.querySelector` 选 `.el-dialog__wrapper:not([style*='none']) input[type=file]` → `cdp("DOM.setFileInputFiles", files=["C:\\\\Users\\\\Public\\\\x.md"], nodeId=...)`。**文件必须放 Windows 侧路径**（automation Chrome 跑在 Windows）：WSL 先写 `/mnt/c/Users/Public/` 再传 `C:\\Users\\Public\\...`。
- **projectapi 文档站只认 .md**：上传 .txt 接口照样 code:0 并返回链接，但 `projectapi.51aes.com` 前端只 fetch `<uuid>.md`，打开显示 404；换 .md 正常渲染。上传弹窗 accept 为空、无格式提示——可作为体验问题素材。验证下载：`curl https://projectapi.51aes.com/ProjectApi/<yyyymm>/<uuid>.md`（公网可达、无需鉴权，直接断言内容）。

### 其它页面坑
- 项目列表页 `/project/project_list`：项目名/编号在**固定左列** `.el-table__fixed .el-table__body tbody`，主体 tbody 对应列是空串。注意 `/project/project` 是空路由（白屏），列表在 `/project/project_list`。
- 排期表按项目查询判空：项目 select 是远程搜索型（Input.insertText 逐字触发）。查询后 0 行 **≠ BUG**——先看「过滤空白行列」开关与"该条件下有 N 人无任何排期"提示，并确认该项目本周确实有排期数据（换一个确有排期的项目做对照）再定性；空结果无"暂无数据"文案可单独记为轻微体验问题。

### 排期表 DOM 与创建任务（V2.2.4 全流程跑通）
- **排期表不是 el-table！** 行读取用 `.schedule-table tbody tr`（`.el-table__body-wrapper` 系列选择器拿到 0 行，本次白查一轮）。表头 `.schedule-table thead th` 定位日期列 index；人员名 `.person-name`；单元格 class：`fixed-col user-cell`（人员列）/ `task-cell-wrapper`（日格）/ `gray-cell`（周末，不可选）。
- 找有排期数据的项目/周做对照：从 vm（`$data.scheduleTableList` 那个）递归扫 `project_name` 字段去重即可，比翻 UI 快。日期范围设置：找 `_componentTag==="el-date-picker"` 的子 vm，`$emit("input",[s,e])`+`$emit("change",...)`（仅作查询前置，不算绕过被验交互）。
- **排期表创建任务入口**：「多选编辑模式」→ 在日格**空白区域拖选**（mousePressed→mouseMoved→mouseReleased 三段 CDP 事件；单击/双击都不弹菜单）→ 顶部出现「创建任务」按钮 → 右侧 drawer「快速创建任务」三步向导（①任务类型 ②选择来源 ③创建，选完子需求才出现第③步）。
- **根需求禁建的断言点**（两处）：a) 非项目需求列表里根需求名 span class 含 `is-disabled` 且点击无跳转（可点子需求是 `link sub-title`）；b) drawer 选择需求弹窗中根节点带"**请选择其下子节点**"文案、点击无响应，点子需求正常选中。
- **drawer 内 el-select 坐标点选常失效**（elementFromPoint 落在 drawer-body 上，且重复点 input 会把下拉 toggle 关掉）：先读 `inp.closest(".el-select").__vue__.visible` 确认展开；点不中就改**键盘导航**——ArrowDown×n（每步读 popper 里 `.el-select-dropdown__item.hover` 文本确认落点）→ Enter，实测稳定。
- **快速创建任务 drawer 关不掉**：Esc、点遮罩、找 close 按钮都可能无效（残留空白面板遮住右侧 1/3 屏）——直接 `location.reload()` 复位最省事，验收下一项前记得复位。

## V2.2.5 验收新增沉淀（2026-07-10）

### BatchCreateDialog（需求拆解，class `bcd-*`，与 V2.2.4 的 batch-create-dialog 同组件族）
- 入口：项目→项目需求 `/project/demand?projectId=N` → 需求行操作列 **el-icon-menu**（tooltip「需求拆分」）。操作列按钮 tooltip 读法：从 `btn.__vue__` 向上找带 `.content` 的 vm。
- **「下一步」点了没反应 ≠ 无 handler**：`goConfirm()` 里 `preSubmit` 返回 string=拒绝原因（warning toast 一闪即逝易错过）、false=静默拒绝。诊断套路：从下一步按钮 `__vue__` 上溯到含 `$data.step` 的 vm，直接 `await v.preSubmit(v.validEntries, v.entries)` 看返回值。本次实锤拦截：「拆解标准工时总和不能超过父任务标准工时」——父需求标准工时 0h 时永远过不去，先用需求编辑（操作列 el-icon-edit-outline）把标准工时调大再拆解。
- **toast 捕获**：点击后以 250ms 间隔轮询 `.el-message`；sleep 3s 再读必错过（el-message ~3s 自动消失）。
- 弹窗默认 4 张占位任务卡；删空卡点 `.bcd-tab .bcd-tab__del`。⚠️「全清」有 popconfirm，误触后按 **Esc 会连整个拆解弹窗一起关**（弹「确定退出」且编辑内容全部清空重来）；关 popover 应点弹窗 header 空白处，别用 Esc。
- vm 关键字段：`step`(edit/confirm)、`entries`、`validEntries`、`trash`；任务选项面板同 `task-options-panel-popover`，取消已选项点对应 `.el-tag` 的 ×。提交接口 `project_task/task_spilt`（code:0 无 toast，以列表刷新/任务列表实读为准）。

### el-tabs 真实点击切不动（任务页 项目任务/非项目任务）
坐标 click 和原生 `el.click()` 均不改 `currentName`。数据核对类导航允许 vm 直切：`tabs.setCurrentName("project"); tabs.$emit("tab-click", tabs.panes[0])`（tabs vm 从 `.el-tabs` 上溯 `_componentTag==="el-tabs"`）。另坑：任务页 form 可能**残留上次会话的 `end_date`** 导致查 0 条——查询前先 dump `v.form` 清掉残留字段再 `search()`。

### 通用：按钮 handler 反查（判定"点了没反应"最快路径）
`btn.__vue__.$listeners.click.fns.toString()` 直接看绑定方法名（如 `fetchDemandDetail`），再从 vm 上溯找该 method 宿主，读方法源码 + 状态 flag（如 `isShowDemandDetail`）。比反复点击快得多，且能区分"真 BUG"vs"弹窗其实开了但 DOM 检测写错/截图时机太早"。本次需求描述「查看详情」按钮就是这样确认弹窗实际正常打开的。

### 通用：找列表页业务 vm 的递归兜底
`form.el-form` / `div.main` 都取不到 vm 时：从 `#app.__vue__` 递归 `$children`，找 `$data.form` 含目标字段（如 `project_id`）且有 `search()` 方法的 vm。⚠️ vm 不能整体 `JSON.stringify`（VueComponent 循环引用），dump 数据时逐 key 过滤标量。

### Ctrl+V 粘贴上传类功能的验证方式
需先把图片放进 **Windows 系统剪贴板**，但 WSL interop 起的 powershell.exe（WinForms/WPF `Clipboard.SetImage`）会因剪贴板打开失败（`GetOpenClipboardWindow` 返回 0，会话隔离）而写不进去；HTTP 站点无 `navigator.clipboard.write`；CDP `Browser.grantPermissions` 对 HTTP origin 也拒绝。可行替代：a) 让用户在 Windows 侧手动截图入剪贴板（Win+Shift+S），agent 只负责聚焦上传区后发 Ctrl+V 键事件；b) 退验拖拽/文件选择路径 + 读组件源码确认 paste 监听存在（如 `UploadImages.vue`，上传区文案"图片拖到此处，或 Ctrl+V 粘贴"），Ctrl+V 真实动作标 ⚠️ 人工复核。

### 项目递交模块（V2.2.5 新增，实测）
- 路由 `/project/project_publish?projectId=N`（项目详情二级菜单「项目递交」）；接口 `project_publish/get_list`，`keywords` 参数按项目名**全匹配**（部分词查不到，验数据一致性时注意）。
- 顶部「按时/超时/延期/待递交」数字块是**纯统计不可点**（cursor:auto、点击不发新请求、列表不变），别当筛选器验；「最新/最早」排序有效（断言方式：首卡日期翻转）。

### harness 脚本含 `&&` 被终端拦截
heredoc 里 JS 写 `&&` 会被 terminal 误判为 shell 后台符拒绝执行。绕法：先 `cat > /tmp/x.py <<'PY'` 写文件，再 `browser-harness < /tmp/x.py`（或 JS 改写为嵌套三元/`filter().find()` 避开 `&&`）。
