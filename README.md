# 云知天气 · 微信原生天气预报小程序

> 一份能交课程作业、也能写进简历的入门项目。**同一个产品、两套独立的数据层实现**：
> `weather-xml/` 用 WebService + XML 报文（教学版），`weather-json/` 用稳定 JSON 接口（面试演示版）。

---

## 一、项目介绍

基于**微信原生小程序**（WXML / WXSS / JavaScript，不用任何框架、不构建 npm）开发的天气预报应用。输入城市名称即可查询当前温度、天气状况、风向风力、湿度，以及未来三天预报；默认加载昆明，附带快捷城市、数据源切换、原始报文查看等功能。

课程作业版特意对接了教材里经典的 **WebXml 天气预报 WebService**：接口返回的是 XML 而不是 JSON。项目里完整实现了「发起网络请求 → 以纯文本接收 XML 报文 → 手写解析器把 XML 转成 JS 对象 → 渲染页面」的链路，关键代码用 `★` 醒目标注，方便截图放进实验报告。

### 这个项目的几个可讲点（面试用）

| 点 | 说明 |
| --- | --- |
| 不用 DOMParser | 小程序没有 `window` / `document` / `DOMParser`，`xmldom` 又要构建 npm，于是手写了一个约 100 行的「标签栈」XML 解析器，含实体解码、CDATA、命名空间前缀处理 |
| `dataType: 'text'` | `wx.request` 默认 `dataType: 'json'` 会强制 `JSON.parse`，XML 必然出错；改成非 `json` 值才能拿到原始报文字符串 |
| 状态码自己判 | 小程序里 HTTP 4xx / 5xx 也会进 `success` 回调，必须手动检查 `res.statusCode` |
| 视图模型归一化 | 两个版本输出**同一份 `weather` 对象结构**，所以从 XML 换到 JSON 时 WXML / WXSS 几乎零改动，只换数据层 |
| 优雅降级 | 老接口不可用时自动回退到结构完全一致的演示 XML / 离线 JSON 快照，且页面明确标注数据来源，不冒充实时数据 |
| Promise 化网络层 | 把 `wx.request` 包成 Promise，串起「地理编码 → 天气预报」两次请求，避免回调地狱 |

---

## 二、两个版本怎么选

| | `weather-xml/`（主版本） | `weather-json/`（备用版本） |
| --- | --- | --- |
| 用途 | 课程作业、实验报告、XML 教学截图 | 面试现场演示、长期可运行 |
| 数据源 | WebXml WeatherWebService（返回 XML） | Open-Meteo（返回 JSON，免费、无需 Key） |
| 请求 | 1 次 `wx.request`，`dataType: 'text'` | 2 次 `wx.request`（地理编码 + 预报），`dataType: 'json'` |
| 解析 | 手写 `utils/xml-parser.js` | 框架自动解析 + `normalize()` 字段映射 |
| 稳定性 | 差，老服务已返回 500（见 `docs/01`） | 好，2026-11-09 实测可用 |
| 兜底 | 自动回退到内置昆明 XML 演示报文 | 自动回退到内置 JSON 快照 |

> 两个版本是**各自完整的独立小程序工程**，可分别用微信开发者工具「导入项目」打开，互不依赖。

---

## 三、目录结构

```
.
├── README.md                          ← 本文件：项目介绍 / 运行 / 截图 / 简历描述
├── docs/
│   ├── 01-XML接口说明与局限.md        ← 接口字段表 + 8 条局限性（实测）
│   └── 02-切换JSON版本指南.md         ← 失效后如何改造 + 面试话术
├── weather-xml/                       ← 【版本 A】WebService / XML
│   ├── app.js / app.json / app.wxss / sitemap.json / project.config.json
│   ├── utils/
│   │   ├── xml-parser.js              ← 手写 XML 解析器（清洗 / 实体 / 标签栈 / 字段映射）
│   │   └── mock-data.js               ← 离线演示 XML 报文生成器
│   └── pages/index/
│       ├── index.js                   ← ★ 关键代码：请求 + 接收 XML + 解析（截图 ①）
│       ├── index.wxml                 ← 页面结构
│       ├── index.wxss                 ← 页面样式
│       └── index.json
├── weather-json/                      ← 【版本 B】稳定 JSON
│   ├── app.js / app.json / app.wxss / sitemap.json / project.config.json
│   ├── utils/weather-api.js           ← Promise 化请求 + WMO 代码映射 + 视图模型归一化
│   └── pages/index/                   ← 四件套（WXML/WXSS 与 A 版基本一致）
└── screenshots/                       ← 可选：三张截图的排版参考示意（非真实截图，可整个删除）
```

---

## 四、快速运行

1. 安装 **微信开发者工具**，新建/导入项目时选「**不使用 AppID（测试号）**」即可（`project.config.json` 里已写 `touristappid`）。
2. 「导入项目」→ 目录选 `weather-xml/`（JSON 版同理选 `weather-json/`）→ 点击「确定」。
3. 右上角 **详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」**（课程作业必做，否则请求被拦截）。
4. 点「编译」，模拟器会默认查询**昆明**并展示结果。

> **建议答辩/截图时这样操作**：XML 版顶部有 `在线接口 / 演示报文` 切换，默认会先尝试真实 WebService，5 秒内失败自动切到「演示报文」。直接点一下「演示报文」可以立刻出图，不受网络影响；想现场演示 `wx.request` 真的发出去了，点「在线接口」，并在开发者工具 **Network 面板**里展示请求记录。

> JSON 版使用 `geocoding-api.open-meteo.com` 与 `api.open-meteo.com` 两个 HTTPS 域名。正式上线前需在小程序后台把它们加入 **request 合法域名**；本地调试勾选上面的选项即可。

---

## 五、三张截图怎么截（作业交付）

| # | 内容 | 具体位置 / 操作 |
| --- | --- | --- |
| ① | **获取 XML 天气数据的关键 JS 代码** | 在开发者工具编辑器打开 `weather-xml/pages/index/index.js`，滚动到 `★★★★★ 关键代码 START` 到 `关键代码 END` 这一块，缩放到能完整看到 `wx.request` + `dataType: 'text'` + `const xmlText = res.data` + `parseWeatherXml`。建议把字号调小一点让整块入镜。也可直接用 `screenshots/01-XML关键代码.html` 作为排版参考。 |
| ② | **小程序页面执行界面** | 编译后在模拟器中截图，保留顶部导航栏 + 模拟器外框，展示搜索框、快捷城市、数据源切换。可先清空输入框或点「在线接口」停在加载态，体现「程序正在运行」。参考 `screenshots/02-小程序运行界面.html`。 |
| ③ | **昆明天气查询结果** | 输入框保持「昆明」→ 点「查询」或点「演示报文」，等主卡片与「未来三天预报」全部渲染出来后截图；建议多滚一屏把预报卡片也带上。参考 `screenshots/03-昆明天气结果.html`。 |

小技巧：截图 ③ 前把手机模拟器缩放调到 100%、主题用浅色，卡片阴影和蓝色渐变更清晰；页面底部的「原始 XML 报文」展开后也可以再补一张，用来证明真的收到了 XML。

> `screenshots/` 里只是三张**排版参考示意**（HTML + PNG），用来对齐版式和该圈哪几行，**不是真实运行截图**。正式作业的截图请用微信开发者工具按上表自己截；这个目录不需要的话可以直接整个删掉，不影响两个小程序工程运行。

---

## 六、简历项目描述（可直接复制）

**简洁版**

> **云知天气 · 微信原生小程序** ｜ 个人项目 ｜ WXML / WXSS / JavaScript
> 独立开发天气预报小程序，支持城市检索、实时天气与未来三天预报；对接 WebService 接口并**手写轻量 XML 解析器**完成报文解析（无第三方依赖）；额外实现一版稳定 JSON 数据层，通过**视图模型归一化**做到切换数据源时视图层零改动，并加入失败降级与离线兜底。

**详细版（适合项目经历一栏）**

> **云知天气 —— 微信原生天气预报小程序**（课程设计 / 个人项目）
> - 技术栈：微信原生小程序（WXML / WXSS / JS）、`wx.request`、轻量 XML 解析、Promise
> - 实现城市输入检索、快捷城市、温度/天气状况/风向风力/湿度展示、未来三天预报、原始报文查看；
> - 对接返回 **XML** 的天气预报 WebService，通过 `dataType: 'text'` 获取原始报文；因小程序无 `DOMParser`，**自行实现标签栈 XML 解析器**，支持实体解码、CDATA、命名空间与字段映射；
> - 抽象 `renderXml()` 与 `normalize()` 两类数据入口，统一输出视图模型，使 XML 版与 JSON 版**共用同一套 WXML/WXSS**；
> - 针对老接口不稳定问题设计**自动降级**：请求失败或状态码异常时回退到同结构演示报文，界面明确标注数据来源；
> - 提供基于 Open-Meteo 的稳定 JSON 版本，Promise 化网络层串联地理编码与天气预报两次请求，用于面试现场演示。

**面试口述（30 秒）**

> 「这是个入门项目，但我特意选了返回 XML 的老 WebService。难点有两个：一是 `wx.request` 默认会把响应当 JSON 解析，得改成 `dataType: 'text'` 才能拿到原始 XML；二是小程序没有 `DOMParser`，也不想为了作业去构建 npm，所以手写了一个标签栈解析器。后来这个接口挂了，我没有改页面，而是把数据层换成了 JSON 接口，用 `normalize()` 保证输出结构不变，WXML 一行没动就跑起来了。这也是我理解的分层：数据层可以换，视图层不该被数据源绑死。」

---

## 七、常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| 请求报 `url not in domain list` | 未勾选「不校验合法域名」，按第四步设置 |
| `res.data` 是乱码 / 解析报错 | `dataType` 忘了设成 `'text'`；或服务端返回了 GB2312 编码，需要做编码转换 |
| 一直显示「演示报文（离线）」 | 老 WebService 已不可用（实测 500 / HTTPS 超时），属预期行为；切到 `weather-json/` 可拿实时数据 |
| 中文城市名查不到 | GET 查询串必须 `encodeURIComponent`，代码里已处理 |
| 想换成别的 XML 接口 | 只改 `WEATHER_WS_URL` 和 `utils/xml-parser.js` 里的 `parseWeatherXml()` 字段映射，页面不用动 |
| 想换实时数据但保留 XML | 见 `docs/01` 最后一节「替换 XML 数据源」 |

---

## 八、文档索引

- `docs/01-XML接口说明与局限.md`：接口地址、请求参数、XML 报文样例、23 个字段对照表、**8 条局限性（含 2026-11-09 实测结果）**
- `docs/02-切换JSON版本指南.md`：接口失效后的逐文件改造清单、XML/JSON 对照表、面试讲法
- `README.md` 第五节：三张截图的具体截法（截哪个文件、哪段代码、页面怎么操作）
