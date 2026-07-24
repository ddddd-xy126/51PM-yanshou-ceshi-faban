// 轻量 md→html 转换（pandoc 不可用时的兜底）。用完即弃。
const fs = require('fs');
const path = require('path');
const src = process.argv[2];
const out = process.argv[3];
const md = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
};

const lines = md.split('\n');
let html = [];
let i = 0;
const flushList = (buf, tag) => { if (buf.length) { html.push(`<${tag}>` + buf.map((x) => `<li>${inline(x)}</li>`).join('') + `</${tag}>`); buf.length = 0; } };

while (i < lines.length) {
  let line = lines[i];
  // 表格
  if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
    const header = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    i += 2;
    const rows = [];
    while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
      rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      i++;
    }
    let t = '<table><thead><tr>' + header.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
    for (const r of rows) t += '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
    t += '</tbody></table>';
    html.push(t);
    continue;
  }
  // 标题
  let m = line.match(/^(#{1,6})\s+(.*)$/);
  if (m) { const lv = m[1].length; html.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue; }
  // hr
  if (/^---+\s*$/.test(line)) { html.push('<hr/>'); i++; continue; }
  // 引用
  if (/^>\s?/.test(line)) {
    const buf = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
    html.push('<blockquote>' + buf.map((x) => inline(x)).join('<br/>') + '</blockquote>');
    continue;
  }
  // 无序列表（含缩进子项，简单扁平处理）
  if (/^\s*-\s+/.test(line)) {
    const buf = [];
    while (i < lines.length && /^\s*-\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*-\s+/, '')); i++; }
    flushList(buf, 'ul');
    continue;
  }
  // 有序列表
  if (/^\s*\d+\.\s+/.test(line)) {
    const buf = [];
    while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
    flushList(buf, 'ol');
    continue;
  }
  // 空行
  if (/^\s*$/.test(line)) { i++; continue; }
  // 段落
  html.push(`<p>${inline(line)}</p>`);
  i++;
}

const style = `
:root{color-scheme:light}
body{margin:0 auto;max-width:920px;padding:40px 48px;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:#1a1a1a;line-height:1.7;background:#fdfdfd}
h1{font-size:1.9em;border-bottom:3px solid #4a7;padding-bottom:.3em}
h2{font-size:1.45em;border-bottom:1px solid #ddd;padding-bottom:.25em;margin-top:1.8em}
h3{font-size:1.2em;margin-top:1.5em;color:#2a6}
h4{font-size:1.05em;color:#444}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.94em}
th,td{border:1px solid #d0d7de;padding:7px 10px;text-align:left;vertical-align:top}
th{background:#f0f6f2}
tr:nth-child(even){background:#fafbfa}
code{background:#f2f4f2;padding:1px 5px;border-radius:4px;font-size:.9em;font-family:Consolas,Monaco,monospace}
blockquote{border-left:4px solid #9c9;background:#f6faf7;margin:1em 0;padding:.6em 1em;color:#444}
hr{border:none;border-top:1px solid #e0e0e0;margin:1.5em 0}
a{color:#268}
ul,ol{padding-left:1.6em}
li{margin:.2em 0}
`;

const doc = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>51PM V2.2.9 验收报告</title>
<style>${style}</style></head>
<body>
${html.join('\n')}
</body></html>`;
fs.writeFileSync(out, doc, 'utf8');
console.log('html written:', out);
