#!/usr/bin/env node
'use strict';

// 抓取『51PM 用户反馈表』里「需求分析结果」字段仍为空的记录，
// 供 agent 按 SKILL.md 的分析步骤逐条/逐组处理。
// 用法：node fetch-new-feedback.js

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./load-config');
const { listAllRecords } = require('./feishu-client');

function fieldToText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || item.name || JSON.stringify(item);
        return String(item);
      })
      .join(' / ');
  }
  if (typeof value === 'object') return value.text || value.name || JSON.stringify(value);
  return String(value);
}

function dateFieldToText(value) {
  // 日期字段飞书以毫秒时间戳返回，转成可读格式
  if (typeof value === 'number' && value > 1e11) {
    return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
  }
  return fieldToText(value);
}

async function main() {
  const config = loadConfig();
  const records = await listAllRecords(config);

  const pending = records.filter((record) => {
    const fields = record.fields || {};
    const resultText = fieldToText(fields[config.fields.result]).trim();
    if (resultText) return false; // 已有分析结果，跳过

    if (config.pendingStatusValues.length) {
      const statusText = fieldToText(fields[config.fields.status]).trim();
      if (!config.pendingStatusValues.includes(statusText)) return false;
    }
    return true;
  });

  const output = pending.map((record) => {
    const fields = record.fields || {};
    return {
      record_id: record.record_id,
      模块: fieldToText(fields[config.fields.module]),
      问题描述: fieldToText(fields[config.fields.description]),
      // 附件类型字段这里只能拿到文件名列表，无法自动读图，详见 README「已知限制」
      问题截图图片: fieldToText(fields[config.fields.screenshot]),
      优先级: fieldToText(fields[config.fields.priority]),
      需求反馈状态: fieldToText(fields[config.fields.status]),
      进度留言: fieldToText(fields[config.fields.progressNote]),
      反馈版本号: fieldToText(fields[config.fields.versionNo]),
      发布版本号: fieldToText(fields[config.fields.releaseVersionNo]),
      反馈类型: fieldToText(fields[config.fields.feedbackType]),
      // 以下仅供人工 review 参考展示，不参与分析推理
      任务类型: fieldToText(fields[config.fields.taskType]),
      责任人: fieldToText(fields[config.fields.owner]),
      提交人: fieldToText(fields[config.fields.submitter]),
      创建时间: dateFieldToText(fields[config.fields.createdTime]),
    };
  });

  const snapshotPath = path.join(__dirname, '.pending-feedback.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`共 ${records.length} 条记录，其中待分析 ${output.length} 条。`);
  console.log(`已写入快照：${snapshotPath}`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error('抓取失败：', err.message);
  process.exit(1);
});
