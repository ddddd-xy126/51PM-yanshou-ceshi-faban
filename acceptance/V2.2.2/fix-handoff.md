# 51PM V2.2.2 缺陷修复交接（给前后端开发，可整份投喂 AI）

> 与 acceptance-report.md §二 共用 B# 编号；修完请按各条「通过标准」自验，回传时注明 B#。

## B1 递交/反馈处理写入接口普遍缺服务端权限校验（前端门禁可绕过越权写入）

- 严重度：严重（越权写入，前端门禁形同虚设，多处写入端点系统性缺校验）
- 复现（三处同类，任选其一，均用非授权账号 邓欣羽 #475）：
  1. **QA递交**：递交列表 QA递交按钮被 `testListRooters` 白名单前端禁用 → `document.querySelector('button:has-text("QA递交")').disabled=false` 后点击（或 `PublishList.handleProcess(index,row,dev)`）→ 填表提交
  2. **PM立即解决反馈**：反馈在他人项目 PM 队列不可见+按钮禁用 → 直调 `handleSolveApply({id})` 开弹窗 → 填解决方案 → 立即解决
  3. **PM审批递交**：申请在他人项目 PM 队列 → 直调 `approvedApply(row)` 开「转化为递交」→ 填交付形式/递交内容 → 通过审批创建递交
- 现象：
  - 预期：后端应拒绝非白名单/非该项目 PM 的写入（返回权限错误 code），与前端禁用一致
  - 实际：后端**均接受并落库**——`project_publish` #14335（QA递交，publish_submit_status=2/version=v2.2.2-acc/real_publish_time/t_remark）；反馈 #569 `solution_apply_demand` → apply_demand_status=已沟通解决；申请 #527 `project_publish/add` → 递交创建成功、转已排期
- 定位线索：
  - 前端门禁：递交列表 `PublishList.vue`（QA递交 `:disabled` 绑 `testListRooters`）；信箱 `myMessageBox` index 组件（`approvedApply`/`handleSolveApply`，按 `systemRole`+PM 作用域控制）
  - 后端写入接口：`POST /manage_api/project_publish/add`（PM审批创建递交）、`POST /manage_api/produce_demand/solution_apply_demand`（立即解决）、QA递交提交（`project_publish` 命名空间，`createSubmissionForm.vue` 提交方法）——均建议在 controller 入口加与前端一致的角色/白名单/项目归属校验
- 通过标准：非授权账号（不在 `testListRooters` / `systemRole!=='PM'` / 非该项目 PM）调用上述写入接口应返回权限错误（code 非 0 / 403），**不得**写入 `project_publish` / 改反馈状态；对应 `get_list` 中不出现该越权写入记录

---

> 附（非缺陷，前端健壮性，报告 §三 R4）：「我的信箱 → 审批递交申请(PM)」页清空「选择PM」筛选后，`getApplyPublishList`（applyMixins.js:74）对空 PM 参数 `JSON.parse(undefined)` 抛错致列表崩，需先选定 PM 才能查。建议前端对空 PM 筛选参数做容错。
