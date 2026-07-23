# 51PM V2.2.8 缺陷修复交接（给前后端开发，可整份投喂 AI）

> 与 acceptance-report.md §二 共用 B# 编号；修完请按各条「通过标准」自验，回传时注明 B#。

## B1 模型数据看板「资产维度」明细接口负数分页触发 HTTP 500 slice panic

- 严重度：轻微（正常 UI 无此路径，需手工构造非法 limit 触发；但 500 应避免，且同版发包明细同参已能优雅校验）
- 复现：环境测试 10.67.8.183:7777，登录态任意有效账号，直调
  `GET /manage_api/outsource/get_asset_dimension_list?page=1&limit=-5&is_self_made=-1&package_status=-1&task_status=-1`
- 现象：预期返回 code 校验错误（如 code 51/52）或空结果；实际返回 **HTTP 500，报 `slice bounds out of range`**（负数 limit 进入切片计算越界 panic）。对比：同版 `get_package_dimension_list?...&limit=-5`（发包维度）同样传负 limit 却能优雅返回（code 52），说明校验逻辑未对齐。
- 定位线索：接口命名空间 `outsource/get_asset_dimension_list`；后端资产维度分页处理未对 `limit` 做正数/上下界校验，直接用于 slice；参照同 controller 的 `get_package_dimension_list` 已有的负数校验分支补齐。
- 通过标准：`GET /manage_api/outsource/get_asset_dimension_list?page=1&limit=-5&...` 返回 HTTP < 500（报 code 校验错误或按默认分页处理），不再 slice panic。（对应 api-v2.2.8.spec.js 哨兵用例「已知BUG跟踪：资产明细负数 limit 触发 500」，修复后该 `test.fail` 会 unexpected pass，届时删标记转常规断言。）

---

## 附：风险项 R1（非缺陷，健壮性，供后端一并评估）

- 现象：`GET /manage_api/project_publish/get_list?...&is_over_tb_time=abc`（非法枚举）后端不校验，返回介于全量（-1）与超时集（1）之间的部分集。
- 建议：非法枚举报 code 51 或按默认全量处理；对应 api-v2.2.8.spec.js 哨兵「已知问题跟踪：is_over_tb_time 非法枚举不校验」，修复后转常规断言。
- 通过标准：`is_over_tb_time=abc` 返回结果 == 全量（-1）结果，或返 code 51。
