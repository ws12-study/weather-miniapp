// pages/index/index.js
// 云知天气 · 微信小程序（WebService / XML 版本）
//
// 本文件是「课程作业截图 ①」的目标文件。
// 三大核心流程都集中在下面标了 ★ 的关键代码区：
//   ① 网络请求 wx.request
//   ② 以纯文本接收完整 XML 报文
//   ③ 调用手写解析器把 XML 转成 JS 对象并渲染

const { parseWeatherXml } = require('../../utils/xml-parser.js');
const { getDemoXml } = require('../../utils/mock-data.js');

// ─────────────────────────────── 接口配置 ───────────────────────────────
// WebXml 天气预报 WebService，HTTP GET 形式调用，返回 XML（ArrayOfString）
//
// 注：官方原始地址是 http://www.webxml.com.cn/... （老站点没有可用的 HTTPS 证书），
//     而小程序正式环境强制 HTTPS，所以这里写成 https。
//     本地调试想真正打一次网络请求时，把下面这行改成 http:// 并在
//     开发者工具「详情 → 本地设置」勾选「不校验合法域名」即可。
//     接口本身已不稳定（实测返回 500），失败会自动回退到演示报文。
const WEATHER_WS_URL =
  'https://www.webxml.com.cn/WebServices/WeatherWebService.asmx/getWeatherbyCityName';
const REQUEST_TIMEOUT = 5000; // 老接口响应慢，设短超时，失败立刻回退演示报文
const QUICK_CITIES = ['昆明', '北京', '上海', '广州'];

Page({
  data: {
    cityInput: '昆明',
    quickCities: QUICK_CITIES,
    mode: 'live', // 'live' = 真实 WebService；'demo' = 离线演示报文
    loading: false,
    error: '',
    weather: null,
    rawXml: '',
    showXml: false,
    sourceText: '',
    sourceClass: ''
  },

  // 默认查询昆明：打开小程序就能直接截「昆明天气结果」图
  onLoad: function () {
    this.queryWeather('昆明');
  },

  // ─────────────────────────── 页面交互事件 ───────────────────────────
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

  onModeChange: function (e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode: mode });
    this.queryWeather(this.data.cityInput || '昆明');
  },

  toggleXml: function () {
    this.setData({ showXml: !this.data.showXml });
  },

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  ★★★★★  关键代码 START —— 截图 ① 请完整截取这一块  ★★★★★          ║
  // ║                                                                      ║
  // ║  ① 发起 wx.request 网络请求（GET + 中文城市名 URL 编码）              ║
  // ║  ② 以「纯文本」接收完整 XML 报文（禁止框架做 JSON.parse）             ║
  // ║  ③ 手写 XML 解析器 → JS 对象 → setData 渲染页面                       ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  queryWeather: function (city) {
    this.setData({ loading: true, error: '' });

    // 教学/答辩开关：离线模式直接把一份标准 XML 交给同一套解析流程
    if (this.data.mode === 'demo') {
      this.renderXml(getDemoXml(city), 'demo');
      return;
    }

    wx.request({
      // ① 城市名是中文，必须 encodeURIComponent，否则 GET 查询串会乱码
      url: WEATHER_WS_URL + '?theCityName=' + encodeURIComponent(city),
      method: 'GET',
      header: { 'content-type': 'text/xml; charset=utf-8' },
      timeout: REQUEST_TIMEOUT,

      // ② ★★★ 获取 XML 报文最关键的两行 ★★★
      //    wx.request 的 dataType 默认是 'json'，框架会对响应强制 JSON.parse，
      //    XML 会被直接解析失败 / 变成乱码。改成 'text'（任意非 json 值均可），
      //    微信就不处理响应体，res.data 就是服务端返回的原始 XML 字符串。
      dataType: 'text',
      responseType: 'text',

      success: (res) => {
        // 坑点：HTTP 4xx / 5xx 在小程序里同样会进入 success，必须自己判状态码
        if (res.statusCode !== 200 || typeof res.data !== 'string') {
          this.fallbackToDemo(city, '接口返回 HTTP ' + res.statusCode);
          return;
        }

        // ③ ★★★ res.data 此时就是完整的 XML 报文字符串 ★★★
        //    形如：<?xml ...?><ArrayOfString ...><string>云南</string>...</ArrayOfString>
        const xmlText = res.data;
        console.log('[收到原始 XML 报文]\n' + xmlText);

        try {
          this.renderXml(xmlText, 'live');
        } catch (err) {
          this.fallbackToDemo(city, err.message);
        }
      },

      fail: (err) => {
        // 域名未加入合法域名 / 超时 / 无网络 / 证书异常，都会走这里
        this.fallbackToDemo(city, (err && err.errMsg) || '网络请求失败');
      }
    });
  },
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  ★★★★★  关键代码 END  ★★★★★                                        ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  /**
   * 把 XML 字符串交给解析器，解析结果写入 data。
   * 真实接口与演示报文共用这一条链路，保证解析逻辑始终被真实执行。
   */
  renderXml: function (xmlText, source) {
    // ★ 关键：utils/xml-parser.js 的 parseWeatherXml
    //    内部顺序：清洗报文 → 实体解码 → 标签栈建树 → 抽取全部 <string>
    //              → 按官方 23 个下标映射成业务对象
    const weather = parseWeatherXml(xmlText);

    this.setData({
      loading: false,
      error: '',
      weather: weather,
      rawXml: xmlText,
      sourceText: source === 'live' ? 'WebService 实时数据' : '演示报文（离线）',
      sourceClass: source === 'live' ? 'tag-live' : 'tag-demo'
    });
  },

  /** 接口不可用时自动回退到演示报文，页面和截图永远有内容 */
  fallbackToDemo: function (city, reason) {
    console.warn('[天气接口不可用，已切换演示报文]', reason);
    this.setData({ mode: 'demo' });
    this.renderXml(getDemoXml(city), 'demo');
    wx.showToast({
      title: '接口暂不可用，已切换演示报文',
      icon: 'none',
      duration: 2200
    });
  }
});
