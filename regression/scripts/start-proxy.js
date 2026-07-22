// 本地 8888 TCP 转发：51PM 测试环境前端把 API 写死为 localhost:8888，
// 真实后端在 10.67.8.189:8888。跑测试前必须有这条转发。
// 可独立运行：node scripts/start-proxy.js
const net = require('net');
const http = require('http');

// ⚠️ 后端真实 IP 会漂移（2026-07-21 从 10.67.8.183 迁到 10.67.8.189，前端构建已直连 .189）。
// 这里是全仓库后端地址的单一真源：proxy 转发目标 + 阶段0 登录态自检（check-login.js）都引用它。
// 后端再次迁移时只改这两行。判断当前值：浏览器打开 app 后看 performance 里 manage_api 请求的 host。
const TARGET_HOST = '10.67.8.189';
const TARGET_PORT = 8888;
const LISTEN_PORT = 8888;

/** 探活：端口被占用时验证占用者确实是能响应 HTTP 的转发（而非其他程序占着端口） */
function probeLocal8888() {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port: LISTEN_PORT, path: '/', timeout: 3000 },
      (res) => {
        res.resume(); // 任意 HTTP 响应（含 404）都说明后端链路通
        resolve();
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('探活超时'));
    });
    req.on('error', reject);
  });
}

function startProxy() {
  return new Promise((resolve, reject) => {
    const server = net.createServer((client) => {
      const upstream = net.connect(TARGET_PORT, TARGET_HOST);
      client.pipe(upstream).pipe(client);
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // 端口被占用 ≠ 转发在跑（可能是其他程序），探活确认后才放行
        probeLocal8888()
          .then(() => {
            console.log(`[proxy] 127.0.0.1:${LISTEN_PORT} 已被占用，探活通过（HTTP 有响应），复用现有转发`);
            resolve(null);
          })
          .catch((probeErr) =>
            reject(
              new Error(
                `端口 ${LISTEN_PORT} 被占用且探活失败（${probeErr.message}）——` +
                  `占用者可能不是 51PM 转发，请用 netstat -ano | findstr :${LISTEN_PORT} 排查后释放端口`
              )
            )
          );
      } else reject(err);
    });
    server.listen(LISTEN_PORT, '127.0.0.1', () => {
      console.log(`[proxy] 127.0.0.1:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT} 已启动`);
      resolve(server);
    });
  });
}

module.exports = { startProxy, TARGET_HOST, TARGET_PORT };

if (require.main === module) {
  startProxy().then((s) => {
    if (s) console.log('[proxy] Ctrl+C 停止');
  });
}
