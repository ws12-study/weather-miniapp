# 02 · 接口失效后：如何改成稳定 JSON 版本（面试演示用）

> 对应工程：`weather-json/`（**与 `weather-xml/` 完全独立的另一套工程**）
> 本文只讲 JSON 版本与迁移方法。XML 接口本身的字段与局限请看 `01-XML接口说明与局限.md`。

---

## 一、为什么面试演示必须换 JSON

XML 版的老 WebService 已经返回 500 / HTTPS 超时（见 `docs/01` 的实测记录）。面试现场最怕「演示环节接口挂了」，所以准备一个**免费、免 Key、HTTPS、有稳定 SLA** 的数据源，并且保留离线快照兜底。

本项目选的是 **Open-Meteo**：

| 项 | 内容 |
| --- | --- |
| 地理编码 | `https://geocoding-api.open-meteo.com/v1/search?name=昆明&count=1&language=zh&format=json` |
| 天气预报 | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=...&daily=...&timezone=Asia/Shanghai&forecast_days=3` |
| 是否需要 Key | **不需要** |
| 协议 | HTTPS，符合小程序 `request` 合法域名要求 |
| 返回 | 标准 JSON，字段名语义化（`current.temperature_2m`、`daily.time[]`） |
| 覆盖 | 全球，支持中文城市名，含当前实况 + 逐日预报 |
| 2026-11-09 实测 | 两个接口均 **HTTP 200**，昆明/北京/上海/广州中文名均可解析 |

请求参数说明：

- `current`：当前实况字段，逗号分隔。本项目取 `temperature_2m, relative_humidity_2m, apparent_temperature, weather_code, wind_speed_10m, wind_direction_10m`
- `daily`：逐日预报数组。本项目取 `weather_code, temperature_2m_max, temperature_2m_min, wind_speed_10m_max, wind_direction_10m_dominant`
- `timezone=Asia/Shanghai`：让返回的日期是北京时间，不用自己换算
- `forecast_days=3`：只要三天，减少数据量

> 其它可选稳定源：和风天气（需注册 Key，国内知名度高）、高德天气（需 Key）、彩云天气、心知天气、以及**自建 Node 代理**（把任意源统一成自己的 JSON 结构，面试里最加分）。

---

## 二、两个版本的差异对照

| 环节 | XML 版 `weather-xml/` | JSON 版 `weather-json/` |
| --- | --- | --- |
| 请求次数 | 1 次，城市名直接查天气 | 2 次：地理编码拿经纬度 → 查天气 |
| `dataType` | `'text'`（禁止框架 `JSON.parse`） | `'json'`（框架自动解析） |
| `res.data` 类型 | `string`，完整 XML 报文 | `Object`，可直接取属性 |
| 解析 | `utils/xml-parser.js` 手写标签栈解析器 | 无需解析器，`normalize()` 做字段映射 |
| 字段定位 | 数组下标 `arr[5]` / `arr[7]` | 语义字段 `current.temperature_2m` |
| 天气现象 | 中文字符串直接展示 | WMO 数字代码 → `WMO` 表映射成中文 + 图标 |
| 风向风力 | 服务端给中文，直接展示 | 角度 → 八方位；km/h → 蒲福风级 |
| 网络层组织 | `Page` 里直接写 `wx.request` 回调 | `utils/weather-api.js` Promise 化，页面只调 `fetchWeather()` |
| 兜底 | 生成同结构 XML 演示报文 | 内置真实 JSON 快照 |
| **WXML / WXSS** | 基准 | **几乎完全一致**（仅把「原始 XML 报文」文案改成「原始 JSON 数据」） |

---

## 三、改造清单（逐文件，可直接照着做）

### Step 1 · 新建数据层 `utils/weather-api.js`，删掉 XML 解析器

- 删除 `utils/xml-parser.js`、`utils/mock-data.js`
- 新建 `utils/weather-api.js`，包含三块：
  1. `request(url, data)`：把 `wx.request` 包成 Promise，`dataType: 'json'`，并手动判 `statusCode`
  2. `wmoInfo()` / `windDir()` / `windLevel()`：把数字代码翻译成页面要展示的中文
  3. `normalize(place, forecast)`：**把 JSON 转成和 XML 版一模一样的 `weather` 对象**

`normalize()` 输出结构（两个版本的契约）：

```js
{
  province, city, cityCode, updateTime,
  today: { temp, tempRange, condition, wind, humidity, icon },
  live, lifeIndex, intro,
  forecast: [ { label, tempRange, condition, wind, icon }, ... ]  // 今天/明天/后天
}
```

> **这一步是整个迁移的核心**。只要契约不变，`index.wxml` 里的 `{{weather.today.temp}}`、`wx:for="{{weather.forecast}}"` 全部原样可用。

### Step 2 · 页面 JS 只改 `queryWeather()`

XML 版（约 60 行：请求 + 文本接收 + 解析 + 回退）：

```js
wx.request({
  url: ..., dataType: 'text', responseType: 'text',
  success: (res) => this.renderXml(res.data, 'live'),
  fail: (err) => this.fallbackToDemo(city, err.errMsg)
});
```

JSON 版（约 15 行）：

```js
fetchWeather(city)
  .then((result) => this.setData({ weather: result.weather, rawJson: result.rawJson }))
  .catch((err) => this.setData({ error: err.message }));
```

`onInput` / `onSearch` / `onQuickTap` / `toggleXml` 这些交互函数**一行都不用改**。

### Step 3 · WXML 只改一处文案

把「`</> 原始 XML 报文`」改成「`{ } 原始 JSON 数据`」，绑定事件从 `toggleXml` 换成 `toggleRaw`，绑定的数据从 `rawXml` 换成 `rawJson`。其余卡片、列表、样式全部照搬。

### Step 4 · WXSS 原样复制

`weather-json/pages/index/index.wxss` 与 XML 版是同一份文件，直接 copy。

### Step 5 · 配置合法域名

微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → `request 合法域名` 加入：

```
https://geocoding-api.open-meteo.com
https://api.open-meteo.com
```

本地调试阶段勾选「不校验合法域名」即可。这一步是 XML 版做不到的（老站点没有 HTTPS），也是面试里可以主动讲的一个工程差异。

### Step 6 · 加离线快照（可选但强烈建议）

在 `weather-api.js` 里内置一份真实抓取的 JSON 响应，`fetchWeather()` 的 `.catch()` 中判断 `err.isNetwork` 为 true 时返回 `getDemoResult()`，页面标签显示「离线快照（断网兜底）」。面试官拔网线也能演示。

---

## 四、面试怎么讲这件事（把「接口挂了」变成加分项）

**别这么说**：「那个接口失效了，我换了一个。」
**建议这么说**（问题 → 判断 → 方案 → 结果）：

> 「课程版用的是教材里的 WebService，返回 XML。它其实有几个硬伤：只有 HTTP、小程序真机无法配置合法域名、返回体是无字段名的 23 元素数组，而且服务本身已经不稳定。
>
> 所以我做了两件事。第一，**分层**：页面不直接碰数据源，数据层统一输出一份 `weather` 视图模型，XML 解析和 JSON 归一化都收敛在 `utils/` 里。第二，**准备第二套数据层**：换成 Open-Meteo 的 JSON 接口，Promise 化 `wx.request` 串起地理编码和天气预报两次请求，用 `normalize()` 保证输出结构不变。最终切源时 WXML/WXSS 只改了一处文案，页面逻辑零改动。
>
> 另外我给两版都加了降级：XML 版失败回退到同结构演示报文，JSON 版断网回退到内置快照，界面会明确标注数据来源，不会拿假数据冒充实时数据。」

**可能被追问的点，提前准备**

| 追问 | 回答要点 |
| --- | --- |
| 为什么不直接用 JSON？ | 课程要求练习 WebService / XML 解析；同时保留 JSON 版体现「同一问题两种数据形态」的理解 |
| 小程序里怎么解析 XML？ | `dataType:'text'` 拿原始字符串；没有 `DOMParser` 也不想构建 npm，手写标签栈解析器，处理实体、CDATA、命名空间 |
| `dataType` 不设会怎样？ | 默认 `'json'`，框架会 `JSON.parse`，XML 直接失败；且 4xx/5xx 仍进 `success`，要自己判 `statusCode` |
| 两次请求串行会不会慢？ | 地理编码结果可以本地缓存（城市名 → 经纬度），第二次请求直接跳到天气；本项目为教学保持直白 |
| 上线还要做什么？ | 配置 request 合法域名、加请求防抖、加错误重试、把城市编码缓存到 `wx.setStorageSync`、接入自己的后端代理隐藏第三方依赖 |

---

## 五、验收清单

- [ ] `weather-json/` 能单独用微信开发者工具导入并编译
- [ ] 默认加载昆明，显示温度、天气状况、风向风力、湿度、三天预报
- [ ] 输入北京 / 上海 / 广州能正常切换
- [ ] 展开「原始 JSON 数据」能看到完整响应
- [ ] 断网时显示「离线快照（断网兜底）」而不是白屏
- [ ] 能对着代码讲清楚 `normalize()` 为什么让视图层零改动
