#!/bin/bash
# 迁移 WSL 侧 51pm 参考笔记 + 备份里的 V2.2.3 过程截图
set -e
DST='/mnt/d/project/51PM验收-测试-发版'

# 1. 参考笔记
mkdir -p "$DST/skills/references"
cp ~/.hermes/skills/browser-harness/references/51pm-*.md "$DST/skills/references/"
cd ~/.hermes/skills/browser-harness/references
for f in 51pm-*.md; do
  a=$(md5sum "$f" | cut -d' ' -f1)
  b=$(md5sum "$DST/skills/references/$f" | cut -d' ' -f1)
  if [ "$a" = "$b" ]; then echo "$f 一致"; else echo "$f 不一致!"; fi
done

# 2. acceptance 备份中现仓库没有的文件（V2.2.3 精简前的过程截图等）
BAK=~/Developer/browser-harness/agent-workspace/acceptance.bak-20260709
CUR=/mnt/d/project/hermes-agent/AgentGroups/BrowserHarness/agent-workspace/acceptance
mkdir -p "$DST/acceptance/_bak-20260709-独有文件"
count=0
while IFS= read -r line; do
  # diff -rq 输出格式: Only in <dir>: <file>
  dir=$(echo "$line" | sed 's/^Only in \(.*\): .*/\1/')
  file=$(echo "$line" | sed 's/^Only in .*: //')
  rel=${dir#"$BAK"}
  mkdir -p "$DST/acceptance/_bak-20260709-独有文件$rel"
  cp "$dir/$file" "$DST/acceptance/_bak-20260709-独有文件$rel/"
  count=$((count+1))
done < <(diff -rq "$BAK" "$CUR" 2>/dev/null | grep '^Only in /home')
echo "备份独有文件已迁: $count 个"
find "$DST/acceptance/_bak-20260709-独有文件" -type f | wc -l
