/**
 * utils/mock-data.js
 * 离线演示报文生成器（教学 / 答辩 / 截图用）
 *
 * 背景：WebXml 的老 WebService 已长期不稳定（详见 docs/01-XML接口说明与局限.md）。
 * 为了保证「打开小程序就有内容、随时能截图、断网也能答辩」，这里按官方
 * ArrayOfString 的真实报文结构生成一份 XML，走的是与线上接口完全相同的
 * 「接收 XML 字符串 → parseWeatherXml → setData」流程，不绕开解析逻辑。
 *
 * 注意：页面右上角会明确标注「演示报文（离线）」，不会冒充实时数据。
 */

/** XML 文本转义：& < > 必须写成实体，否则报文不合法 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 把一维数组包装成 WebService 返回的标准 XML 报文 */
function toArrayOfStringXml(arr) {
  const body = arr.map((value) => '  <string>' + escapeXml(value) + '</string>').join('\n');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<ArrayOfString xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '               xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
    '               xmlns="http://WebXml.com.cn/">',
    body,
    '</ArrayOfString>'
  ].join('\n');
}

// 四个常用城市的演示数据（数值为教学示例，不代表实时天气）
const PRESETS = {
  '昆明': {
    province: '云南', code: '56778', updated: '2026-11-9 13:00:00',
    temp: '15℃', humidity: '62%', air: '优', uv: '中等',
    days: [
      { range: '8℃/17℃', cond: '11月9日 多云转晴', wind: '西南风 3级' },
      { range: '7℃/16℃', cond: '11月10日 晴', wind: '西南风 2级' },
      { range: '9℃/18℃', cond: '11月11日 多云', wind: '东风 微风' }
    ],
    dress: '昼夜温差较大，建议着薄外套或牛仔衫裤，早晚注意添衣。',
    cold: '天凉空气干燥，较易发生感冒，请注意适当防护、多饮水。',
    sport: '天气较好，紫外线中等，非常适宜户外运动与徒步。',
    intro: '昆明，别称「春城」，云南省省会，地处云贵高原中部，海拔约 1890 米，四季如春、气候温和，是著名的旅游与避暑城市。'
  },
  '北京': {
    province: '北京', code: '54511', updated: '2026-11-9 13:00:00',
    temp: '6℃', humidity: '38%', air: '良', uv: '弱',
    days: [
      { range: '-2℃/8℃', cond: '11月9日 晴', wind: '北风 3级' },
      { range: '-3℃/7℃', cond: '11月10日 晴转多云', wind: '西北风 2级' },
      { range: '-1℃/9℃', cond: '11月11日 多云', wind: '南风 微风' }
    ],
    dress: '气温偏低，建议着棉衣、羽绒服等冬季服装。',
    cold: '昼夜温差大，易发感冒，请注意保暖。',
    sport: '天气晴好但气温较低，建议室内运动或午后户外锻炼。',
    intro: '北京，中华人民共和国首都，直辖市，位于华北平原北部，属典型的暖温带半湿润大陆性季风气候，四季分明。'
  },
  '上海': {
    province: '上海', code: '58362', updated: '2026-11-9 13:00:00',
    temp: '17℃', humidity: '71%', air: '良', uv: '弱',
    days: [
      { range: '13℃/19℃', cond: '11月9日 阴转小雨', wind: '东北风 3级' },
      { range: '12℃/18℃', cond: '11月10日 小雨', wind: '东风 3级' },
      { range: '11℃/17℃', cond: '11月11日 多云', wind: '北风 2级' }
    ],
    dress: '湿度较大，建议着薄外套，外出携带雨具。',
    cold: '气温变化不大，感冒风险较低。',
    sport: '有降水，不建议进行户外运动。',
    intro: '上海，直辖市，位于长江入海口，属亚热带季风气候，温和湿润、雨量充沛，是中国的经济、金融与航运中心。'
  },
  '广州': {
    province: '广东', code: '59287', updated: '2026-11-9 13:00:00',
    temp: '24℃', humidity: '68%', air: '优', uv: '强',
    days: [
      { range: '20℃/27℃', cond: '11月9日 多云', wind: '东南风 2级' },
      { range: '21℃/28℃', cond: '11月10日 晴', wind: '南风 微风' },
      { range: '20℃/26℃', cond: '11月11日 多云转阵雨', wind: '东风 2级' }
    ],
    dress: '天气温暖，建议着短袖、薄长裤等夏秋季服装。',
    cold: '气候温暖，感冒风险低。',
    sport: '紫外线较强，户外运动请注意防晒与补水。',
    intro: '广州，广东省省会，别称「羊城」「花城」，地处珠江三角洲，属亚热带季风气候，温暖多雨、长夏短冬。'
  }
};

/**
 * 生成指定城市的 XML 演示报文。
 * 未知城市沿用昆明气候模板，但替换城市名，保证任意输入都有可解析的报文。
 */
function getDemoXml(city) {
  const name = (city || '昆明').trim();
  const preset = PRESETS[name];
  const p = preset || Object.assign({}, PRESETS['昆明'], { province: '' });
  const d0 = p.days[0], d1 = p.days[1], d2 = p.days[2];

  // 严格按官方 23 个字段的顺序拼装（下标注释见 xml-parser.js）
  const arr = [
    p.province,                                   // 0 省份
    name,                                         // 1 城市
    p.code,                                       // 2 城市代码
    p.code + '.jpg',                              // 3 城市图片
    p.updated,                                    // 4 最后更新时间
    d0.range, d0.cond, d0.wind, '1.gif', '0.gif',// 5-9 今天
    '今日天气实况：气温：' + p.temp + '；风向/风力：' + d0.wind +
      '；湿度：' + p.humidity + '；空气质量：' + p.air + '；紫外线强度：' + p.uv, // 10 实况
    '穿衣指数：' + p.dress + '\n感冒指数：' + p.cold + '\n运动指数：' + p.sport,   // 11 生活指数
    d1.range, d1.cond, d1.wind, '0.gif', '0.gif',// 12-16 明天
    d2.range, d2.cond, d2.wind, '1.gif', '1.gif',// 17-21 后天
    p.intro                                       // 22 城市介绍
  ];

  return toArrayOfStringXml(arr);
}

module.exports = { getDemoXml: getDemoXml };
