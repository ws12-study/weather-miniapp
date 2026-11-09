// app.js · 小程序全局入口
App({
  globalData: {
    // 全局只放少量配置；接口地址放在 pages/index/index.js 顶部，方便截图讲解
    appName: '云知天气'
  },

  onLaunch: function () {
    console.log('[云知天气] 小程序启动 · WebService / XML 版本');
  }
});
