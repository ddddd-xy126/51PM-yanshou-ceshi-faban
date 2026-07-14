// 本地 8888 TCP 转发：51PM 测试环境前端把 API 写死为 localhost:8888，
// 真实后端在 10.67.8.183:8888。跑测试前必须有这条转发。
// 可独立运行：node scripts/start-proxy.js
const net = require('net');

const TARGET_HOST = '10.67.8.183';
const TARGET_PORT = 8888;
const LISTEN_PORT = 8888;

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
        // 已有转发（可能是常驻的），视为可用
        console.log(`[proxy] 127.0.0.1:${LISTEN_PORT} 已被占用，假定转发已在运行`);
        resolve(null);
      } else reject(err);
    });
    server.listen(LISTEN_PORT, '127.0.0.1', () => {
      console.log(`[proxy] 127.0.0.1:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT} 已启动`);
      resolve(server);
    });
  });
}

module.exports = { startProxy };

if (require.main === module) {
  startProxy().then((s) => {
    if (s) console.log('[proxy] Ctrl+C 停止');
  });
}
