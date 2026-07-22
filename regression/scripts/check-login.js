// 阶段0 登录态有效性自检：仅靠 state.json 文件存在 ≠ token 有效。
// token 会因 SSO 过期而失效，此时全量回归会跑 10+ 分钟后全红，且极易被误判成"后端宕机"。
// 本脚本用存档 token 直连后端打一个认证接口，据业务码判断是否过期，秒级拦在阶段0。
//
// 退出码：0=登录态有效；2=已过期需 npm run login；3=环境异常（后端不可达/无 state.json 等）
// 用法：node scripts/check-login.js   或   npm run check
const fs = require('fs');
const path = require('path');
const http = require('http');
const { TARGET_HOST, TARGET_PORT } = require('./start-proxy');

const STATE = path.resolve(__dirname, '../auth/state.json');
const API = '/manage_api/version/get_current_version'; // 轻量认证接口：有效 code=0，过期 code=444 用户不存在

function fail(code, msg) {
  console.error(`\x1b[31m[登录自检] ${msg}\x1b[0m`);
  process.exit(code);
}

if (!fs.existsSync(STATE)) fail(3, `未找到 auth/state.json，请先 npm run login`);

let token;
try {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  for (const o of state.origins || []) {
    const item = (o.localStorage || []).find((l) => l.name === 'oauthToken');
    if (item) {
      try {
        token = JSON.parse(item.value).curToken || item.value;
      } catch {
        token = item.value;
      }
      break;
    }
  }
} catch (e) {
  fail(3, `解析 state.json 失败：${e.message}`);
}
if (!token) fail(3, `state.json 里没有 oauthToken，请先 npm run login`);

const req = http.request(
  {
    host: TARGET_HOST,
    port: TARGET_PORT,
    path: API,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token, token },
    timeout: 6000,
  },
  (res) => {
    let b = '';
    res.on('data', (c) => (b += c));
    res.on('end', () => {
      let j;
      try {
        j = JSON.parse(b);
      } catch {
        return fail(3, `后端 ${TARGET_HOST}:${TARGET_PORT} 返回非 JSON（HTTP ${res.statusCode}），环境异常`);
      }
      if (j.code === 0) {
        console.log(`\x1b[32m[登录自检] 通过：token 有效（后端 ${TARGET_HOST}:${TARGET_PORT}）\x1b[0m`);
        process.exit(0);
      }
      // code=444 用户不存在 / 401 等 = 登录态失效
      fail(2, `token 已失效（code=${j.code} ${j.msg || j.message || ''}）——请先运行 npm run login 再跑回归`);
    });
  }
);
req.on('timeout', () => {
  req.destroy();
  fail(3, `连接后端 ${TARGET_HOST}:${TARGET_PORT} 超时——确认后端 IP 是否又漂移（改 scripts/start-proxy.js 的 TARGET_HOST）`);
});
req.on('error', (e) => fail(3, `连不上后端 ${TARGET_HOST}:${TARGET_PORT}（${e.code || e.message}）——后端可能迁移，核对 TARGET_HOST`));
req.end();
