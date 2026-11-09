# 01 · WebService（XML）天气接口说明与局限性

> 对应工程：`weather-xml/`
> 本文只讲 **XML 版本** 的接口。JSON 版本的改造方案请看 `02-切换JSON版本指南.md`，两份文档与两套代码都是分开的。

---

## 一、接口是什么

教材/实验指导里最常用的「天气预报 WebService」，来自 WebXml（webxml.com.cn），是一个 .NET ASMX 服务。除了 SOAP 调用，它还开放了 **HTTP GET 形式**，直接返回 XML 文本，很适合教学演示。

| 项 | 内容 |
| --- | --- |
| 方法 | `getWeatherbyCityName` |
| 原始地址 | `http://www.webxml.com.cn/WebServices/WeatherWebService.asmx/getWeatherbyCityName` |
| 请求方式 | `GET`（也支持 POST / SOAP 1.1 / SOAP 1.2） |
| 参数 | `theCityName` = 城市中文名（如 `昆明`）或城市代码（如 `56778`）；不传默认上海 |
| 返回类型 | `ArrayOfString`，一维字符串数组 `String(22)`，**共 23 个 `<string>` 元素** |
| 编码 | `utf-8` |
| 数据范围 | 当天实况 + 未来三天预报 + 生活指数 |

> 小程序正式环境要求 HTTPS，所以 `weather-xml/pages/index/index.js` 里写的是 `https://www.webxml.com.cn/...`。本地调试想打真实请求，改成 `http://` 并勾选「不校验合法域名」即可。

### 请求示例

```
GET http://www.webxml.com.cn/WebServices/WeatherWebService.asmx/getWeatherbyCityName?theCityName=%E6%98%86%E6%98%8E
```

在小程序里对应（也就是截图 ① 里的关键代码）：

```js
wx.request({
  url: WEATHER_WS_URL + '?theCityName=' + encodeURIComponent(city),
  method: 'GET',
  header: { 'content-type': 'text/xml; charset=utf-8' },
  dataType: 'text',        // ★ 必须：否则框架会 JSON.parse 掉 XML
  responseType: 'text',    // ★ 必须：按文本接收
  success: (res) => {
    const xmlText = res.data;                    // ★ 完整 XML 报文字符串
    const weather = parseWeatherXml(xmlText);   // ★ 手写解析器 → JS 对象
  }
});
```

### 返回报文样例（真实结构）

```xml
<?xml version="1.0" encoding="utf-8"?>
<ArrayOfString xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns="http://WebXml.com.cn/">
  <string>云南</string>
  <string>昆明</string>
  <string>56778</string>
  <string>56778.jpg</string>
  <string>2026-11-9 13:00:00</string>
  <string>8℃/17℃</string>
  <string>11月9日 多云转晴</string>
  <string>西南风 3级</string>
  <string>1.gif</string>
  <string>0.gif</string>
  <string>今日天气实况：气温：15℃；风向/风力：西南风 3级；湿度：62%；空气质量：优；紫外线强度：中等</string>
  <string>穿衣指数：建议着薄外套…&#xA;感冒指数：…&#xA;运动指数：…</string>
  <string>7℃/16℃</string>
  <string>11月10日 晴</string>
  <string>西南风 2级</string>
  <string>0.gif</string>
  <string>0.gif</string>
  <string>9℃/18℃</string>
  <string>11月11日 多云</string>
  <string>东风 微风</string>
  <string>1.gif</string>
  <string>1.gif</string>
  <string>昆明，别称春城，云南省省会…</string>
</ArrayOfString>
```

### 23 个字段对照表（`utils/xml-parser.js` 里的 `parseWeatherXml()` 按下标取值）

| 下标 | 含义 | 页面用途 |
| --- | --- | --- |
| 0 | 省份 / 直辖市 | 城市名旁副标题 |
| 1 | 城市名称 | 卡片标题 |
| 2 | 城市代码 | 保留字段 |
| 3 | 城市图片文件名 | 未使用 |
| 4 | 最后更新时间 | 元信息 |
| 5 | **今天** 气温区间 `8℃/17℃` | 温度区间 |
| 6 | **今天** 天气概况（含日期前缀） | 天气状况 |
| 7 | **今天** 风向和风力 | 风向风力 |
| 8 / 9 | 今天天气趋势图标一 / 二 | 未使用（改用本地图标字符） |
| 10 | 今天的天气实况（气温、湿度、空气质量…） | 大温度数值 + 湿度 + 实况文本 |
| 11 | 天气和生活指数 | 生活指数卡片 |
| 12–16 | **第二天**：气温 / 概况 / 风向 / 图标一 / 图标二 | 明天预报 |
| 17–21 | **第三天**：气温 / 概况 / 风向 / 图标一 / 图标二 | 后天预报 |
| 22 | 被查询城市或地区的介绍 | 城市简介 |

> 接口返回的字段**没有语义名，全靠数组下标**。这是它最不适合工程化的一点，下面会展开。

---

## 二、局限性（重点）

### 1. 服务本身已经不可用了 —— 有实测证据

2026-11-09 在本机实测：

| 请求 | 结果 |
| --- | --- |
| `http://www.webxml.com.cn/.../getWeatherbyCityName?theCityName=昆明` | **HTTP 500**，`未将对象引用设置到对象的实例。` |
| `https://www.webxml.com.cn/.../getWeatherbyCityName?theCityName=昆明` | **连接超时**（站点未部署可用 HTTPS） |
| `http://ws.webxml.com.cn/WebServices/WeatherWS.asmx/getWeather`（新版服务） | **HTTP 500**，且新接口要求商业 `theUserID` |
| 同站的天气图标、图例资源 | 大量失效 |

也就是说：**这不是你代码写错了，是数据源挂了**。这也是本项目做「自动回退演示报文」的原因，以及为什么必须准备 JSON 版本。

### 2. 只有 HTTP，没有可靠 HTTPS

微信小程序 `wx.request` 在**真机与正式环境强制 HTTPS + 备案域名**。这个老站点只有 HTTP，正式发布根本配不了合法域名；本地开发只能靠「不校验合法域名」绕过，属于纯教学环境玩法，不能上线。

### 3. 返回体是「位置数组」，不是带字段名的对象

`ArrayOfString` 的 23 个 `<string>` 全靠下标区分含义：服务端一旦调整顺序或多返回一个元素，客户端就全错位。没有版本号、没有 schema 约束、没有字段名，也没有 null 语义（空值是空字符串）。对比 JSON 的 `current.temperature_2m`，可读性和可维护性差一大截。

### 4. 小程序没有 `DOMParser`，解析要自己造轮子

浏览器里一句 `new DOMParser().parseFromString(xml, 'text/xml')` 就能解决；小程序运行在纯 JSCore/V8 环境，没有 `window`/`document`，npm 的 `xmldom` 又要走「构建 npm」。本项目手写了标签栈解析器（`utils/xml-parser.js`）才跑通，代码量和出错面都明显大于 JSON。

### 5. 编码与转义坑多

中文城市名必须 `encodeURIComponent`；报文里可能出现 `&amp;` `&lt;` `&#xA;` 甚至 CDATA；老服务历史上还出现过 GB2312 与 UTF-8 混用。这些在 JSON 里都不存在（`JSON.parse` 帮你处理）。

### 6. 数据不实时、覆盖有限

它是很老的聚合服务，更新频率低、城市列表固定、同一个城市名重复时还需要先查 `getSupportCity` 拿城市代码；没有经纬度查询、没有逐小时预报、没有 AQI 结构化字段（空气质量被塞在一段中文实况文本里，得用正则抠）。

### 7. 无 SLA、无配额说明、无错误码体系

失败时可能返回 500 纯文本、空数组、SOAP Fault 或一个 HTML 错误页，`success` 回调照样触发（小程序里 4xx/5xx 也进 `success`）。必须像本项目那样同时判断 `res.statusCode`、`res.data` 类型、`<string>` 数量，否则很容易白屏。

### 8. 无法用于真实产品

没有 Key、没有鉴权、没有 HTTPS、没有稳定性承诺、商业调用要 `theUserID`。它适合「讲清楚 WebService 与 XML 解析」，不适合任何上线场景。**简历上可以写它体现原理理解，但演示一定要能切到 JSON 版本**，否则面试官一问「接口挂了怎么办」就卡住了。

---

## 三、本项目是怎么兜住这些局限的

| 局限 | 项目里的处理 |
| --- | --- |
| 接口 500 / 超时 | `timeout: 5000` + 手动判 `statusCode` + `fail` 回调统一走 `fallbackToDemo()` |
| 解析需要 DOMParser | 手写 `utils/xml-parser.js`，含实体解码 / CDATA / 命名空间 / 标签栈 |
| 数组下标易错位 | 解析前校验 `arr.length < 23` 直接抛错，避免渲染出乱码数据 |
| 演示不能翻车 | `utils/mock-data.js` 按官方结构生成标准 XML，走**同一条解析链路** |
| 不能冒充实时数据 | 页面右上角标签明确显示「演示报文（离线）」 |
| 面试要现场跑通 | 独立 `weather-json/` 工程，实时接口 + 离线快照双保险 |

---

## 四、如果只想换个「还活着的 XML 源」（不换 JSON）

如果老师坚持必须看到真实的 XML 网络请求，可以保留整套架构，只改两处：

1. `weather-xml/pages/index/index.js` 顶部的 `WEATHER_WS_URL`；
2. `weather-xml/utils/xml-parser.js` 里的 `parseWeatherXml()` —— 把「按下标取 23 个 `<string>`」改成「按标签名取节点」，例如：

```js
const root = parseXml(xmlText);
const city = textOf(findNodes(root, 'city')[0]);
const temp = textOf(findNodes(root, 'temperature')[0]);
```

`parseXml()` / `findNodes()` / `textOf()` 这些底层能力可以原样复用，页面层完全不用动。

可选的真实 XML 源（**都需要自己先验证可用性**）：

- 挪威气象局 MET Norway：`https://api.met.no/weatherapi/locationforecast/1.9/?lat=..&lon=..`（返回 XML，但必须带自定义 `User-Agent`，且要先做地理编码拿经纬度 —— 本次实测该端点超时）
- 自建代理：用 Node/Python 写一个小服务，把任意 JSON 天气接口**包一层 XML** 再返回。课程作业里这招最稳，还能顺带讲「为什么要做接口适配层」

> 提醒：2026 年仍在稳定提供「城市名 → XML 天气」的免费公开接口几乎没有了。所以**工程上的正解就是切 JSON**，见 `02-切换JSON版本指南.md`。
