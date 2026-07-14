module.exports = async () => {
  if (global.__PROXY_SERVER__) {
    global.__PROXY_SERVER__.close();
  }
};
