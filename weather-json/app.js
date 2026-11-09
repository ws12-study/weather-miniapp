// app.js · 小程序全局入口
App({
  globalData: {
    // 全局只放少量配置；接口地址集中在 utils/weather-api.js，便于统一维护
    appName: '云知天气'
  },

  onLaunch: function () {
    console.log('[云知天气] 小程序启动 · 稳定 JSON 版本');
  }
});
