// globalSetup：起 8888 代理 + 校验登录态是否存在
const fs = require('fs');
const path = require('path');
const { startProxy } = require('./start-proxy');

module.exports = async () => {
  const server = await startProxy();
  // 存到全局，teardown 时关闭
  global.__PROXY_SERVER__ = server;

  const statePath = path.join(__dirname, '..', 'auth', 'state.json');
  if (!fs.existsSync(statePath)) {
    throw new Error(
      '未找到登录态 auth/state.json —— 先运行 `npm run login` 完成一次企微扫码登录'
    );
  }
};
