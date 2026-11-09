// pages/index/index.js
// 云知天气 · 微信小程序（稳定 JSON 版本 / 面试演示用）
//
// 与 XML 版的差异只在「数据层」：
//   XML 版：wx.request(dataType:'text') → 原始 XML 字符串 → 手写 parseWeatherXml
//   JSON 版：utils/weather-api.js 把 wx.request(dataType:'json') 封装成 Promise，
//            框架自动 JSON.parse，再经 normalize() 输出同一份视图模型
//   因此 WXML / WXSS 与 XML 版基本一致，迁移成本极低（面试可重点讲这一点）。

const { fetchWeather } = require('../../utils/weather-api.js');

const QUICK_CITIES = ['昆明', '北京', '上海', '广州'];

Page({
  data: {
    cityInput: '昆明',
    quickCities: QUICK_CITIES,
    loading: false,
    error: '',
    weather: null,
    rawJson: '',
    showRaw: false,
    sourceText: '',
    sourceClass: ''
  },

  onLoad: function () {
    this.queryWeather('昆明');
  },

  onInput: function (e) {
    this.setData({ cityInput: e.detail.value });
  },

  onSearch: function () {
    const city = (this.data.cityInput || '').trim();
    if (!city) {
      wx.showToast({ title: '请输入城市名称', icon: 'none' });
      return;
    }
    this.queryWeather(city);
  },

  onQuickTap: function (e) {
    const city = e.currentTarget.dataset.city;
    this.setData({ cityInput: city });
    this.queryWeather(city);
  },

  toggleRaw: function () {
    this.setData({ showRaw: !this.data.showRaw });
  },

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  ★ 数据层入口：一次调用即可拿到可直接渲染的 weather 对象               ║
  // ║  两次网络请求（地理编码 → 天气预报）+ 异常兜底都在 weather-api.js 里   ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  queryWeather: function (city) {
    this.setData({ loading: true, error: '' });

    fetchWeather(city)
      .then((result) => {
        const isLive = result.source === 'live';
        this.setData({
          loading: false,
          error: '',
          weather: result.weather,
          rawJson: result.rawJson,
          sourceText: isLive ? 'Open-Meteo 实时数据' : '离线快照（断网兜底）',
          sourceClass: isLive ? 'tag-live' : 'tag-demo'
        });
        if (!isLive) {
          wx.showToast({ title: '网络不可用，已启用离线快照', icon: 'none', duration: 2200 });
        }
      })
      .catch((err) => {
        this.setData({ loading: false, error: (err && err.message) || '查询失败，请稍后重试' });
        wx.showToast({ title: '查询失败', icon: 'none' });
      });
  }
});
