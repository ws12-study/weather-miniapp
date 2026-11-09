/**
 * utils/weather-api.js
 * 稳定 JSON 数据层 —— Open-Meteo（免费、无需 API Key、HTTPS、有 SLA）
 *
 * 与 XML 版的最大区别：
 *   · dataType 保持 'json'，微信框架自动 JSON.parse，res.data 直接是对象
 *   · 不再需要手写 XML 解析器，也不需要按下标硬编码取字段
 *   · 城市名 → 经纬度（Geocoding）→ 天气预报，两次请求用 Promise 链串起来
 *
 * 关键设计：normalize() 把不同数据源统一成同一份「视图模型」，
 *          所以从 XML 版迁移过来时 WXML / WXSS 几乎不用改（详见 docs/02）。
 */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// ---------------------------------------------------------------- WMO 天气代码
/** Open-Meteo 使用 WMO 4677 天气代码，需要自己映射成中文文案与图标 */
const WMO = {
  0: ['晴', '☀️'], 1: ['大部晴朗', '🌤️'], 2: ['局部多云', '⛅'], 3: ['阴', '☁️'],
  45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'],
  51: ['小毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['大毛毛雨', '🌧️'],
  56: ['冻毛毛雨', '🌧️'], 57: ['强冻毛毛雨', '🌧️'],
  61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'], 67: ['强冻雨', '🌧️'],
  71: ['小雪', '❄️'], 73: ['中雪', '❄️'], 75: ['大雪', '❄️'], 77: ['米雪', '❄️'],
  80: ['阵雨', '🌦️'], 81: ['强阵雨', '🌧️'], 82: ['暴雨', '🌧️'],
  85: ['阵雪', '❄️'], 86: ['强阵雪', '❄️'],
  95: ['雷雨', '⛈️'], 96: ['雷雨伴冰雹', '⛈️'], 99: ['强雷雨伴冰雹', '⛈️']
};

function wmoInfo(code) {
  const pair = WMO[code] || ['未知', '🌤️'];
  return { text: pair[0], icon: pair[1], code: code };
}

// ---------------------------------------------------------------- 工具函数
/** 角度 → 八方位中文风向 */
function windDir(deg) {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  if (deg === undefined || deg === null) return '无持续';
  return dirs[Math.round(Number(deg) / 45) % 8];
}

/** 风速 km/h → 蒲福风级（简化版） */
function windLevel(kmh) {
  const k = Number(kmh) || 0;
  const bounds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  for (let i = 0; i < bounds.length; i++) {
    if (k < bounds[i]) return i + '级';
  }
  return '12级';
}

function at(arr, i, fallback) {
  return arr && arr[i] !== undefined && arr[i] !== null ? arr[i] : fallback;
}

function roundTemp(v) {
  return v === undefined || v === null || v === '--' ? '--' : String(Math.round(Number(v)));
}

function fmtTemp(v) {
  return v === undefined || v === null ? '--℃' : Math.round(Number(v)) + '℃';
}

// ------------------------------------------------- 网络请求（Promise 化封装）
/**
 * wx.request 本身不返回 Promise，这里统一包一层。
 * ★ 对比 XML 版：dataType 用 'json'，框架会自动 JSON.parse，
 *   res.data 已经是 JS 对象，无需任何解析代码。
 */
function request(url, data) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      data: data,
      method: 'GET',
      dataType: 'json',
      responseType: 'text',
      timeout: 10000,
      success: function (res) {
        // 4xx / 5xx 依然会进 success，必须自己判
        if (res.statusCode !== 200) {
          const e = new Error('接口返回 HTTP ' + res.statusCode);
          e.isNetwork = true;
          reject(e);
          return;
        }
        if (!res.data || typeof res.data !== 'object') {
          const e = new Error('返回数据不是合法 JSON 对象');
          e.isNetwork = true;
          reject(e);
          return;
        }
        resolve(res.data);
      },
      fail: function (err) {
        const e = new Error((err && err.errMsg) || '网络请求失败');
        e.isNetwork = true;
        reject(e);
      }
    });
  });
}

// ------------------------------------------------------------ 视图模型归一化
/**
 * ★ 迁移的核心：把 Open-Meteo 的 JSON 转成与 XML 版完全一致的 weather 对象。
 *   只要这个函数输出结构不变，index.wxml / index.wxss 就能原样复用。
 */
function normalize(place, fc) {
  const cur = fc.current || {};
  const daily = fc.daily || {};
  const now = wmoInfo(cur.weather_code);

  const today = {
    label: '今天',
    temp: roundTemp(cur.temperature_2m),
    tempRange: fmtTemp(at(daily.temperature_2m_min, 0)) + ' / ' + fmtTemp(at(daily.temperature_2m_max, 0)),
    condition: now.text,
    wind: windDir(cur.wind_direction_10m) + '风 ' + windLevel(cur.wind_speed_10m),
    humidity: (cur.relative_humidity_2m === undefined ? '--' : cur.relative_humidity_2m + '%'),
    icon: now.icon
  };

  const labels = ['今天', '明天', '后天'];
  const times = daily.time || [];
  const forecast = times.map(function (t, i) {
    const info = wmoInfo(at(daily.weather_code, i, 0));
    return {
      label: labels[i] || String(t).slice(5),
      tempRange: fmtTemp(at(daily.temperature_2m_min, i)) + ' / ' + fmtTemp(at(daily.temperature_2m_max, i)),
      condition: info.text,
      wind: windDir(at(daily.wind_direction_10m_dominant, i)) + '风 ' +
            windLevel(at(daily.wind_speed_10m_max, i, 0)),
      icon: info.icon
    };
  });

  const tempNow = Number(cur.temperature_2m) || 0;
  const dressing = tempNow >= 25 ? '天气温暖，建议着短袖、薄长裤等夏装。'
    : tempNow >= 15 ? '气温舒适，建议着薄外套或长袖衬衫。'
    : tempNow >= 5 ? '天气偏凉，建议着毛衣、夹克等，早晚注意添衣。'
    : '气温较低，建议着棉衣、羽绒服等冬季服装。';
  const hasRain = /雨|雪|雷/.test(now.text);
  const sport = hasRain ? '有降水，不建议进行户外运动，可选择室内锻炼。'
    : '天气条件良好，适宜户外运动与散步。';

  return {
    province: place.admin1 || '',
    city: place.name,
    cityCode: String(place.id || ''),
    updateTime: String(cur.time || '').replace('T', ' '),
    today: today,
    live: '今日实况：气温：' + fmtTemp(cur.temperature_2m) +
      '；体感温度：' + fmtTemp(cur.apparent_temperature) +
      '；湿度：' + today.humidity + '；风向/风力：' + today.wind +
      '；风速：' + (cur.wind_speed_10m === undefined ? '--' : cur.wind_speed_10m + ' km/h') + '。',
    lifeIndex: '穿衣指数：' + dressing + '\n运动指数：' + sport +
      '\n出行提示：' + (hasRain ? '记得携带雨具，注意路面湿滑。' : '天气晴好，适合出行。'),
    intro: (place.admin1 ? place.admin1 + ' · ' : '') + place.name +
      '（' + (place.country || '') + '），海拔约 ' +
      (place.elevation === undefined ? '--' : place.elevation) + ' 米。数据源：Open-Meteo 数值天气预报。',
    forecast: forecast.length ? forecast : [today]
  };
}

// ------------------------------------------------------------ 对外查询入口
/**
 * 查询天气：① 地理编码拿经纬度 → ② 拿当前实况与 3 日预报 → ③ 归一化
 * 返回 { weather, rawJson, source }；网络异常时回退到内置快照，保证演示不翻车。
 */
function fetchWeather(city) {
  const name = (city || '昆明').trim();

  return request(GEO_URL, { name: name, count: 1, language: 'zh', format: 'json' })
    .then(function (geo) {
      if (!geo.results || !geo.results.length) {
        throw new Error('未找到城市「' + name + '」，请检查名称');
      }
      const place = geo.results[0];
      return request(FORECAST_URL, {
        latitude: place.latitude,
        longitude: place.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant',
        timezone: 'Asia/Shanghai',
        forecast_days: 3
      }).then(function (fc) {
        return {
          weather: normalize(place, fc),
          rawJson: JSON.stringify(fc, null, 2),
          source: 'live'
        };
      });
    })
    .catch(function (err) {
      // 「城市不存在」属于用户输入问题，直接抛给页面提示；网络问题才用快照兜底
      if (!err.isNetwork) throw err;
      const demo = getDemoResult(name, err.message);
      return demo;
    });
}

// ------------------------------------------------------- 离线快照（答辩兜底）
// 这是 2026-11-09 从 Open-Meteo 真实拉取的昆明响应，结构完全一致。
const DEMO_FORECAST = {
  latitude: 25.06151, longitude: 102.70474, timezone: 'Asia/Shanghai',
  current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
  current: {
    time: '2026-11-09T13:15', temperature_2m: 3.6, relative_humidity_2m: 86,
    apparent_temperature: 0.8, weather_code: 51, wind_speed_10m: 15.4, wind_direction_10m: 58
  },
  daily: {
    time: ['2026-11-09', '2026-11-10', '2026-11-11'],
    weather_code: [73, 71, 51],
    temperature_2m_max: [8.5, 7.7, 13.4],
    temperature_2m_min: [2.2, 2.1, 5.2],
    wind_speed_10m_max: [18.4, 7.6, 9.1],
    wind_direction_10m_dominant: [54, 358, 221]
  }
};

const DEMO_PLACE = {
  id: 1804651, name: '昆明', admin1: '云南', country: '中国',
  latitude: 25.03889, longitude: 102.71833, elevation: 1895
};

function getDemoResult(city, reason) {
  const place = Object.assign({}, DEMO_PLACE, { name: city || '昆明' });
  return {
    weather: normalize(place, DEMO_FORECAST),
    rawJson: JSON.stringify(DEMO_FORECAST, null, 2),
    source: 'demo',
    offlineReason: reason
  };
}

module.exports = {
  fetchWeather: fetchWeather,
  normalize: normalize,
  wmoInfo: wmoInfo,
  windDir: windDir,
  windLevel: windLevel,
  getDemoResult: getDemoResult
};
