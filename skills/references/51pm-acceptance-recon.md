# 51PM 验收/侦察实测笔记（2026-07-08，V2.2.3 验收会话）

51PM 各功能入口、API、组件定位的实测结论。做验收 / 找功能入口前先读这里，避免重新摸索。有机会时合并回 domain-skills/51pm/。

## 已验证的页面入口与坑

### 递交模块 `/OPStestList/OPStestList_list`
- **本页没有 `form.el-form`**！取 vm 要从 `.el-table` 上溯：`let v = document.querySelector(".el-table").__vue__; while (v && !(v.$data && v.$data.form)) v = v.$parent;`
- form 字段：`begin/end`（datetime 字符串）、`searchDateRange`（数组，要同步设）、查询方法 `searchData()`。相关 data：`total`、`timelineList`、`timelineCollapsed`。
- 默认日期是**今天单日**，通常无数据；放宽日期才有列表（如 04-01~07-08 → 228 条）。
- 点项目名会弹 `el-popconfirm`「是否跳转至该项目概况？」，需再点「确定」才跳 `/project/project_detail?projectId=N`。
- 从详情页返回递交模块后**筛选日期重置回今天**（列表空）——不是折叠 BUG，是筛选不保留。
- el-date-picker range 用 `$emit("input", [...])` 只改显示值，**不触发查询**；查询要走 vm form + searchData()（或点查询按钮）。

### 花费/成本导出 `/statistic/project_cost`
- 页面有「查询」「导出」按钮 + daterange。
- 导出 API：`GET http://10.67.8.189:8888/manage_api/data_export/export_project_cost_list?...&kaigong_date_start=&kaigong_date_end=...`
- **API 鉴权**：`Authorization: Bearer <localStorage.oauthToken>`（cookie 为空，token 在 localStorage 的 `oauthToken`）。curl 直接调可下载 xlsx 验证内容。

### 日报导出 统计→工时 `/statistic/export_estimate`
- 两个 tab：「每日工作概览」「工时数据总览」，由 `chooseNavName` 控制（组件 `statistic/estimate/index.vue`）。
- V2.2.3 新增：`export_daily_estimate_new` 接口 + `ProjectEstimateCardList.vue` 的 `exportForm.includeImages`（"包含制作截图" el-switch，告警文案"导出日报过多，包含图片可能会导致文件过大"）。
- 导出权限 `isCanExport`: 角色须属 `['GHOST','PM','ADMIN','TB']`（`$store.getters.role` 可查当前角色）。
- 2026-07-08 实测：每日工作概览 tab 点「导出」无反应（无弹窗/无下载/无 toast）——疑似 BUG 或入口不在此页，未定论。

## 通用技术（不限 51PM）

### 在压缩后的 Vue SPA 里定位功能入口/API
1. 列 bundle：`performance.getEntriesByType("resource")` 过滤 `.js`，写到文件。
2. WSL 里 curl 全量下载到 /tmp，本地 grep（比在页面里 fetch+搜索快且不超时；页面内异步大循环 js() 会触发 Runtime.evaluate 超时）。
3. grep API 前缀（如 `data_export/`）拿全部接口名；grep 中文 label（如"包含制作截图"）＋ `data-insp-path` 属性能直接反查出 vue 源文件路径与行号（如 `src/components/Nor/ProjectEstimateCardList.vue:233`）。
4. 枚举前端路由：任意 vm 的 `$router.options.routes` 递归展开，按关键字过滤。

### capture_screenshot IPC 超时的兜底
`capture_screenshot()` 偶发 `TimeoutError`（_ipc.py request 超时）。兜底：
```python
cdp("Page.bringToFront"); time.sleep(1)
d = cdp("Page.captureScreenshot", format="jpeg", quality=80).get("data")
open(path, "wb").write(base64.b64decode(d))
```
jpeg + quality 降低载荷，成功率高得多。

### 抓"点按钮后发了什么请求"
点击前注入 hook（window.open / fetch / XMLHttpRequest.prototype.open 各包一层记到 `window.__h`），点击后读回。判定"点了没反应"类 BUG 的关键证据：只发了无关请求（如版本检查）即坐实无响应。

### 验证下载确实发生
浏览器触发的下载看 `/mnt/c/Users/<user>/Downloads/`（`.crdownload` = 进行中）；或 `performance.getEntriesByType("resource")` 查导出 URL 的 responseStatus。内网下载卡住时，用 Bearer token curl 同一 URL 直接落盘验证文件内容（unzip xlsx 读 sharedStrings.xml 断言表头）。
