/**
 * 皮皮法官 - 情侣吵架评理小程序
 */
App({
  onLaunch() {
    console.log('[App] onLaunch 开始');
    try {
      wx.cloud.init({
        env: process.env.CLOUD_ENV_ID || 'YOUR_CLOUD_ENV_ID',
        traceUser: false,
      });
      console.log('[App] wx.cloud.init 调用完成');
    } catch (err) {
      console.error('[App] wx.cloud.init 抛出异常:', err);
    }
  },
  globalData: {
    cloudEnv: process.env.CLOUD_ENV_ID || 'YOUR_CLOUD_ENV_ID',
  },
});
