/**
 * utils/xml-parser.js
 * 轻量 XML 解析器 —— 纯 JavaScript，零第三方依赖
 *
 * 【为什么需要自己写解析器？】
 * 微信小程序运行在 JSCore / V8 的纯 JS 环境里，没有 window、document，
 * 也没有浏览器自带的 DOMParser；npm 上的 xmldom / fast-xml-parser 又需要
 * 先在开发者工具里执行「构建 npm」才能用。
 * 课程作业中手写一个够用的解析器，既能跑通，又能把
 * 「XML 是怎么被读成 JS 对象的」这件事完整讲清楚，答辩时很加分。
 *
 * 【本文件做了什么】
 *   ① cleanXml        去掉 XML 声明 / 注释 / DOCTYPE，并把 CDATA 转成普通文本
 *   ② decodeEntities  还原 &amp; &lt; &gt; &quot; &apos; &#数字; 等实体
 *   ③ parseXml        用「标签栈」把 XML 字符串解析成一棵 JS 对象树
 *   ④ findNodes/textOf 按标签名取节点、取文本
 *   ⑤ parseWeatherXml 把 WebXml 的 ArrayOfString 报文转成页面直接能用的业务对象
 */

// ---------------------------------------------------------------- ① 实体解码
const ENTITY = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

/** 把 XML 中的实体引用还原成真实字符 */
function decodeEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z]+);/g, (all, name) => (name in ENTITY ? ENTITY[name] : all));
}

// ---------------------------------------------------------------- ② 报文清洗
/** 去掉声明、注释、DOCTYPE；CDATA 内容里的 < > & 先转义，避免被当成标签 */
function cleanXml(xml) {
  return String(xml)
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, body) =>
      body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );
}

/** 解析开始标签上的属性：name="value" 或 name='value' */
function parseAttrs(attrStr) {
  const attrs = {};
  const re = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = decodeEntities(m[2] !== undefined ? m[2] : m[3]);
  }
  return attrs;
}

// ---------------------------------------------------------------- ③ 核心解析
/**
 * 用「标签栈」解析 XML 字符串，返回一棵 JS 对象树。
 * 节点结构：{ name, attrs, children: [], text: '' }
 *
 * 原理：正则把报文切成两类 token —— <标签> 和 文本内容。
 *       遇到开始标签就挂到栈顶节点的 children 上并入栈；
 *       遇到结束标签就出栈；文本则累加到栈顶节点的 text 上。
 */
function parseXml(xmlText) {
  const clean = cleanXml(xmlText);
  const virtualRoot = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [virtualRoot];
  const tokenRe = /<([^>]*)>|([^<]+)/g;
  let m;

  while ((m = tokenRe.exec(clean)) !== null) {
    if (m[1] !== undefined) {
      // ---------- 标签 token ----------
      let raw = m[1].trim();
      if (!raw || raw[0] === '?' || raw[0] === '!') continue; // 处理指令 / DOCTYPE
      if (raw[0] === '/') {
        // 闭合标签：出栈（虚拟根不能出栈）
        if (stack.length > 1) stack.pop();
        continue;
      }
      const selfClosing = /\/$/.test(raw);
      raw = raw.replace(/\s*\/$/, '').trim();
      const sp = raw.search(/\s/);
      // 去掉命名空间前缀，例如 <xsd:string> → string
      const tagName = (sp === -1 ? raw : raw.slice(0, sp)).replace(/^[^:]+:/, '');
      const attrs = parseAttrs(sp === -1 ? '' : raw.slice(sp));

      const node = { name: tagName, attrs: attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) stack.push(node);
    } else if (m[2] !== undefined) {
      // ---------- 文本 token ----------
      const text = decodeEntities(m[2]);
      if (text.trim() !== '') stack[stack.length - 1].text += text;
    }
  }

  return virtualRoot.children[0] || null;
}

// ---------------------------------------------------------------- ④ 取值工具
/** 深度优先查找所有同名节点 */
function findNodes(node, name) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (n.name === name) out.push(n);
    (n.children || []).forEach(walk);
  })(node);
  return out;
}

/** 取节点文本（含子节点，兼容混合内容） */
function textOf(node) {
  if (!node) return '';
  let text = node.text || '';
  (node.children || []).forEach((child) => {
    text += textOf(child);
  });
  return text.trim();
}

// ---------------------------------------------------------------- ⑤ 业务解析
/** 天气文字 → 图标字符（不依赖网络图片，页面加载更快，截图更干净） */
function pickIcon(text) {
  const t = text || '';
  if (/雷/.test(t)) return '⛈️';
  if (/雪/.test(t)) return '❄️';
  if (/雨/.test(t)) return '🌧️';
  if (/雾|霾/.test(t)) return '🌫️';
  if (/阴/.test(t)) return '☁️';
  if (/多云/.test(t)) return '⛅';
  if (/晴/.test(t)) return '☀️';
  return '🌤️';
}

/** 去掉「11月9日 」这种日期前缀，只留天气状况 */
function cleanCondition(text) {
  return String(text || '').replace(/^\d{1,2}月\d{1,2}日\s*/, '').trim();
}

/** 从「气温：15℃」这类实况文本里提取温度数字 */
function pickNumber(text) {
  const m = /(-?\d+(?:\.\d+)?)\s*℃/.exec(text || '');
  return m ? m[1] : '--';
}

/** 从实况文本里提取湿度 */
function pickHumidity(text) {
  const m = /湿度[:：]\s*(\d+%)/.exec(text || '');
  return m ? m[1] : '--';
}

/**
 * ★ 业务层解析入口 ★
 * WebXml WeatherWebService 的 getWeatherbyCityName 返回一维字符串数组
 * String(22)，共 23 个 <string> 元素，字段按下标硬编码：
 *
 *   0 省份        1 城市        2 城市代码    3 城市图片     4 最后更新时间
 *   5 今天气温    6 今天概况    7 今天风向    8 今天图标一   9 今天图标二
 *  10 今日实况   11 生活指数
 *  12 明天气温   13 明天概况   14 明天风向   15 明天图标一  16 明天图标二
 *  17 后天气温   18 后天概况   19 后天风向   20 后天图标一  21 后天图标二
 *  22 城市介绍
 */
function parseWeatherXml(xmlText) {
  const root = parseXml(xmlText);
  if (!root) throw new Error('XML 解析失败：报文为空或格式非法');

  // ★ 关键一步：把 XML 树里所有 <string> 节点按顺序还原成字符串数组
  const arr = findNodes(root, 'string').map(textOf);

  // 接口挂掉时常返回一个错误页 / 空数组，这里挡一道
  if (arr.length < 23) {
    throw new Error('XML 字段不足 23 项（实际 ' + arr.length + ' 项），可能接口返回了错误页');
  }

  /** 把连续 5 个字段组装成一天的预报对象 */
  function buildDay(label, base) {
    const condition = cleanCondition(arr[base + 1]);
    return {
      label: label,
      tempRange: arr[base],
      condition: condition,
      wind: arr[base + 2],
      icon: pickIcon(condition)
    };
  }

  const today = buildDay('今天', 5);
  today.temp = pickNumber(arr[10]) !== '--' ? pickNumber(arr[10]) : pickNumber(arr[5]);
  today.humidity = pickHumidity(arr[10]);

  return {
    province: arr[0],
    city: arr[1],
    cityCode: arr[2],
    updateTime: arr[4],
    today: today,
    live: arr[10],
    lifeIndex: arr[11],
    intro: arr[22],
    // 未来三天预报：接口一次给全，直接按下标切片
    forecast: [today, buildDay('明天', 12), buildDay('后天', 17)],
    rawStringCount: arr.length
  };
}

module.exports = {
  parseXml: parseXml,
  parseWeatherXml: parseWeatherXml,
  findNodes: findNodes,
  textOf: textOf,
  decodeEntities: decodeEntities
};
