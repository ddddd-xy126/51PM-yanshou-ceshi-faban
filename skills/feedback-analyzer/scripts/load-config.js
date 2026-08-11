'use strict';

const fs = require('fs');
const path = require('path');

/** 极简 .env 解析（无需额外依赖），已存在的 process.env 优先，不覆盖 */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function loadConfig() {
  loadEnvFile(path.join(__dirname, '.env'));

  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `缺少配置：${missing.join(', ')}。请复制 .env.example 为 .env 并填写（步骤见 README.md）。`
    );
  }

  return {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    appToken: process.env.FEISHU_APP_TOKEN,
    tableId: process.env.FEISHU_TABLE_ID,
    fields: {
      module: process.env.FEISHU_FIELD_MODULE || '模块',
      description: process.env.FEISHU_FIELD_DESCRIPTION || '问题描述',
      screenshot: process.env.FEISHU_FIELD_SCREENSHOT || '问题截图图片',
      priority: process.env.FEISHU_FIELD_PRIORITY || '优先级',
      status: process.env.FEISHU_FIELD_STATUS || '需求&反馈状态',
      progressNote: process.env.FEISHU_FIELD_PROGRESS_NOTE || '进度留言',
      versionNo: process.env.FEISHU_FIELD_VERSION || '反馈版本号',
      releaseVersionNo: process.env.FEISHU_FIELD_RELEASE_VERSION || '发布版本号',
      feedbackType: process.env.FEISHU_FIELD_TYPE || '反馈类型',
      // 仅作元数据展示/透传，不参与分析推理
      taskType: process.env.FEISHU_FIELD_TASK_TYPE || '任务类型',
      owner: process.env.FEISHU_FIELD_OWNER || '责任人',
      submitter: process.env.FEISHU_FIELD_SUBMITTER || '提交人',
      createdTime: process.env.FEISHU_FIELD_CREATED_TIME || '创建时间',
      // 产物B 两个独立回填字段
      result: process.env.FEISHU_FIELD_RESULT || '需求分析结果',
      solutionSummary: process.env.FEISHU_FIELD_SOLUTION_SUMMARY || '产品|解决方案简述',
    },
    // 留空 = 不按状态过滤，只看「需求分析结果」是否为空来判断待分析
    pendingStatusValues: (process.env.FEISHU_PENDING_STATUS_VALUES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

module.exports = { loadConfig };
