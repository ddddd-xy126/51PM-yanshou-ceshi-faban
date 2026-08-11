#!/usr/bin/env node
'use strict';

// 把产物 B 写回飞书『51PM 用户反馈表』——问题整理 → 「需求分析结果」字段，
// 方案推荐 → 「产品|解决方案简述」字段（两个独立列，各写各的）。
// 用法：
//   单条：node write-back.js <record_id> "<问题整理>" "<方案推荐>"
//   批量：node write-back.js --file <记录数组JSON路径>
//         JSON 格式：[{"record_id":"rec1","problemSummary":"问题整理...","solutionSummary":"方案推荐..."}, ...]
//         合并多条来源反馈时，对每个来源 record_id 各写一条（内容相同）。

const fs = require('fs');
const { loadConfig } = require('./load-config');
const { updateRecordFields } = require('./feishu-client');

function printUsageAndExit() {
  console.error('用法：');
  console.error('  单条：node write-back.js <record_id> "<问题整理>" "<方案推荐>"');
  console.error('  批量：node write-back.js --file <记录数组JSON路径>');
  console.error(
    '        JSON 格式：[{"record_id":"rec1","problemSummary":"...","solutionSummary":"..."}, ...]'
  );
  process.exit(1);
}

async function writeOne(config, recordId, problemSummary, solutionSummary) {
  await updateRecordFields({
    ...config,
    recordId,
    fields: {
      [config.fields.result]: problemSummary,
      [config.fields.solutionSummary]: solutionSummary,
    },
  });
  console.log(`✅ 已回填 ${recordId}`);
}

async function main() {
  const config = loadConfig();
  const args = process.argv.slice(2);
  if (args.length === 0) printUsageAndExit();

  if (args[0] === '--file') {
    const filePath = args[1];
    if (!filePath) printUsageAndExit();
    const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const item of items) {
      if (!item.record_id || !item.problemSummary || !item.solutionSummary) {
        console.error(`跳过无效条目：${JSON.stringify(item)}`);
        continue;
      }
      await writeOne(config, item.record_id, item.problemSummary, item.solutionSummary);
    }
    return;
  }

  const [recordId, problemSummary, solutionSummary] = args;
  if (!recordId || !problemSummary || !solutionSummary) printUsageAndExit();
  await writeOne(config, recordId, problemSummary, solutionSummary);
}

main().catch((err) => {
  console.error('回填失败：', err.message);
  process.exit(1);
});
