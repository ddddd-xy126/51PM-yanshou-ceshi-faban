// md→html 转换（pandoc 本机不可用时的标准转换器）。用标准库 markdown-it，勿手搓解析。
// 用法：node scripts/md2html.js <in.md> <out.html> ["页面标题"]
const fs = require('fs');
const MarkdownIt = require('markdown-it');

const src = process.argv[2];
const out = process.argv[3];
const title = process.argv[4] || '51PM 验收报告';
if (!src || !out) {
  console.error('用法: node scripts/md2html.js <in.md> <out.html> ["标题"]');
  process.exit(1);
}

const md = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

// html:true 保留内嵌 html；linkify 自动链接；breaks:true 让发版功能点单行换行紧凑成 <br>
const mdit = new MarkdownIt({ html: true, linkify: true, breaks: true, typographer: false });
const body = mdit.render(md);

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
pre{background:#f6f8fa;padding:12px 14px;border-radius:6px;overflow:auto}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #9c9;background:#f6faf7;margin:1em 0;padding:.6em 1em;color:#444}
hr{border:none;border-top:1px solid #e0e0e0;margin:1.5em 0}
a{color:#268}
ul,ol{padding-left:1.6em}
li{margin:.2em 0}
img{max-width:100%}
`;

const doc = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<style>${style}</style></head>
<body>
${body}
</body></html>`;
fs.writeFileSync(out, doc, 'utf8');
console.log('html written:', out);
