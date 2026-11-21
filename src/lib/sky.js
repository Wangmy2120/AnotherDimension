import { getSolarPosition } from './solar.js'

const DEG = Math.PI / 180
const SAMPLE_STEP_MS = 10 * 60 * 1000
const SAMPLE_COUNT = 145

function normalize(value, cycle = 360) {
  return ((value % cycle) + cycle) % cycle
}

function daysSinceJ2000(date) {
  return date.getTime() / 86400000 + 2440587.5 - 2451545.0
}

function obliquity(date) {
  return 23.4393 - 0.0000004 * daysSinceJ2000(date)
}

function sunEcliptic(date) {
  const days = daysSinceJ2000(date)
  const meanLongitude = normalize(280.46 + 0.9856474 * days)
  const meanAnomaly = normalize(357.528 + 0.9856003 * days) * DEG
  return {
    longitude: normalize(meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)),
    radius: 1.000001 - 0.0167086 * Math.cos(meanAnomaly) - 0.00014 * Math.cos(2 * meanAnomaly)
  }
}

function eclipticToEquatorial(longitude, latitude, eps) {
  const sinLon = Math.sin(longitude * DEG)
  const cosLon = Math.cos(longitude * DEG)
  const sinLat = Math.sin(latitude * DEG)
  const cosLat = Math.cos(latitude * DEG)
  const sinTilt = Math.sin(eps * DEG)
  const cosTilt = Math.cos(eps * DEG)
  return {
    right: normalize(Math.atan2(
      sinLon * cosLat * cosTilt - sinLat * sinTilt,
      cosLon * cosLat
    ) / DEG),
    decl: Math.asin(sinLat * cosTilt + cosLat * sinTilt * sinLon) / DEG
  }
}

function equatorialToEcliptic(right, decl, eps) {
  const sinTilt = Math.sin(eps * DEG)
  const cosTilt = Math.cos(eps * DEG)
  const ra = right * DEG
  const dec = decl * DEG
  return {
    longitude: normalize(Math.atan2(
      Math.cos(dec) * Math.sin(ra) * cosTilt + Math.sin(dec) * sinTilt,
      Math.cos(dec) * Math.cos(ra)
    ) / DEG),
    latitude: Math.asin(Math.sin(dec) * cosTilt - Math.cos(dec) * sinTilt * Math.sin(ra)) / DEG
  }
}

/** 星表历元为 J2000，按黄道总岁差平移到当日平春分点，与行星口径一致。 */
function precessToOfDate(right, decl, centuries, eps) {
  const j2000 = equatorialToEcliptic(right, decl, OBLIQUITY_J2000)
  return eclipticToEquatorial(
    normalize(j2000.longitude + PRECESSION_PER_CENTURY * centuries),
    j2000.latitude,
    eps
  )
}

function equatorialToHorizontal(right, decl, date, latitude, longitude, parallax = 0) {
  const sidereal = normalize(280.46061837 + 360.98564736629 * daysSinceJ2000(date) + longitude)
  let hourAngle = normalize(sidereal - right)
  if (hourAngle > 180) hourAngle -= 360
  const ha = hourAngle * DEG
  const lat = latitude * DEG
  const dec = decl * DEG
  // 地心视差沿地平经圈把天体向地下压：高度减去 π·cos(h)，方位不变。
  const geocentric = Math.asin(
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)
  ) / DEG
  return {
    azimuth: normalize(Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)
    ) / DEG + 180),
    elevation: geocentric - parallax * Math.cos(geocentric * DEG)
  }
}

/**
 * 月球位置取 Meeus《天文算法》第 47 章的截断 ELP2000/82 级数（各 60 项），
 * 黄经精度约 ±10″、黄纬约 ±4″、地心距离约 ±300 km。
 * 辐角四项为日月距角 D、太阳平近点角 M、月球平近点角 M′、升交点平角距 F；
 * 振幅以百万分之一度计，距离项以千分之一千米计，含 M 系数的项另乘偏心率修正 E^|b|。
 * 结果已归算到当日平黄道与平春分点，故不叠加岁差，与行星口径不同。
 */
const MOON_POSITION_TERMS = {
  d: [0, 2, 2, 0, 0, 0, 2, 2, 2, 2,
    0, 1, 0, 2, 0, 0, 4, 0, 4, 2,
    2, 1, 1, 2, 2, 4, 2, 0, 2, 2,
    1, 2, 0, 0, 2, 2, 2, 4, 0, 3,
    2, 4, 0, 2, 2, 2, 4, 0, 4, 1,
    2, 0, 1, 3, 4, 2, 0, 1, 2, 2],
  m: [0, 0, 0, 0, 1, 0, 0, -1, 0, -1,
    1, 0, 1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 1, -1, 0, 0, 0, 1, 0, -1,
    0, -2, 1, 2, -2, 0, 0, -1, 0, 0,
    1, -1, 2, 2, 1, -1, 0, 0, -1, 0,
    1, 0, 1, 0, 0, -1, 2, 1, 0, 0],
  mp: [1, -1, 0, 2, 0, 0, -2, -1, 1, 0,
    -1, 0, 1, 0, 1, 1, -1, 3, -2, -1,
    0, -1, 0, 1, 2, 0, -3, -2, -1, -2,
    1, 0, 2, 0, -1, 1, 0, -1, 2, -1,
    1, -2, -1, -1, -2, 0, 1, 4, 0, -2,
    0, 2, 1, -2, -3, 2, 1, -1, 3, -1],
  f: [0, 0, 0, 0, 0, 2, 0, 0, 0, 0,
    0, 0, 0, -2, 2, -2, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 2, 0,
    0, 0, 0, 0, 0, -2, 2, 0, 2, 0,
    0, 0, 0, 0, 0, -2, 0, 0, 0, 0,
    -2, -2, 0, 0, 0, 0, 0, 0, 0, -2],
  longitude: [6288774, 1274027, 658314, 213618, -185116, -114332, 58793, 57066, 53322, 45758,
    -40923, -34720, -30383, 15327, -12528, 10980, 10675, 10034, 8548, -7888,
    -6766, -5163, 4987, 4036, 3994, 3861, 3665, -2689, -2602, 2390,
    -2348, 2236, -2120, -2069, 2048, -1773, -1595, 1215, -1110, -892,
    -810, 759, -713, -700, 691, 596, 549, 537, 520, -487,
    -399, -381, 351, -340, 330, 327, -323, 299, 294, 0],
  distance: [-20905355, -3699111, -2955968, -569925, 48888, -3149, 246158, -152138, -170733, -204586,
    -129620, 108743, 104755, 10321, 0, 79661, -34782, -23210, -21636, 24208,
    30824, -8379, -16675, -12831, -10445, -11650, 14403, -7003, 0, 10056,
    6322, -9884, 5751, 0, -4950, 4130, 0, -3958, 0, 3258,
    2616, 0, -2117, 2354, 0, 0, 0, 0, 0, 0,
    0, -4421, 0, 0, 0, 0, 1165, 0, 0, 8752]
}

const MOON_LATITUDE_TERMS = {
  d: [0, 0, 0, 2, 2, 2, 2, 0, 2, 0,
    2, 2, 2, 2, 2, 2, 2, 0, 4, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 4, 4,
    0, 4, 2, 2, 2, 2, 0, 2, 2, 2,
    2, 4, 2, 2, 0, 2, 1, 1, 0, 2,
    1, 2, 0, 4, 4, 1, 4, 1, 4, 2],
  m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    -1, 0, 0, 1, -1, -1, -1, 1, 0, 1,
    0, 1, 0, 1, 1, 1, 0, 0, 0, 0,
    0, 0, 0, 0, -1, 0, 0, 0, 0, 1,
    1, 0, -1, -2, 0, 1, 1, 1, 1, 1,
    0, -1, 1, 0, -1, 0, 0, 0, -1, -2],
  mp: [0, 1, 1, 0, -1, -1, 0, 2, 1, 2,
    0, -2, 1, 0, -1, 0, -1, -1, -1, 0,
    0, -1, 0, 1, 1, 0, 0, 3, 0, -1,
    1, -2, 0, 2, 1, -2, 3, 2, -3, -1,
    0, 0, 1, 0, 1, 1, 0, 0, -2, -1,
    1, -2, 2, -2, -1, 1, 1, -1, 0, 0],
  f: [1, 1, -1, -1, 1, -1, 1, 1, -1, -1,
    -1, -1, 1, -1, 1, 1, -1, -1, -1, 1,
    3, 1, 1, 1, -1, -1, -1, 1, -1, 1,
    -3, 1, -3, -1, -1, 1, -1, 1, -1, 1,
    1, 1, 1, -1, 3, -1, -1, 1, -1, -1,
    1, -1, 1, -1, -1, -1, -1, -1, -1, 1],
  latitude: [5128122, 280602, 277693, 173237, 55413, 46271, 32573, 17198, 9266, 8822,
    8216, 4324, 4200, -3359, 2463, 2211, 2065, -1870, 1828, -1794,
    -1749, -1565, -1491, -1475, -1410, -1344, -1335, 1107, 1021, 833,
    777, 671, 607, 596, 491, -451, 439, 422, 421, -366,
    -351, 331, 315, 302, -283, -229, 223, 223, -220, -220,
    -185, 181, -177, 176, 166, -164, 132, -119, 115, 107]
}

function moonArgument(terms, index, angles) {
  return (terms.d[index] * angles.d + terms.m[index] * angles.m
    + terms.mp[index] * angles.mp + terms.f[index] * angles.f) * DEG
}

function moonEcliptic(date) {
  const centuries = daysSinceJ2000(date) / 36525
  const t2 = centuries * centuries
  const t3 = t2 * centuries
  const t4 = t3 * centuries
  const angles = {
    d: normalize(297.8502042 + 445267.1115168 * centuries - 0.00163 * t2 + t3 / 545868 - t4 / 113065000),
    m: normalize(357.5291092 + 35999.0502909 * centuries - 0.0001536 * t2 + t3 / 24490000),
    mp: normalize(134.9634114 + 477198.8675313 * centuries + 0.008997 * t2 + t3 / 69699 - t4 / 14712000),
    f: normalize(93.2720993 + 483202.0175273 * centuries - 0.0034029 * t2 + t3 / 3526000 - t4 / 863310000),
    l: normalize(218.3164591 + 481267.88134236 * centuries - 0.0013268 * t2 + t3 / 538841 - t4 / 65194000),
    a1: normalize(119.75 + 131.849 * centuries),
    a2: normalize(53.09 + 479264.29 * centuries),
    a3: normalize(313.45 + 481266.484 * centuries)
  }
  const ecc = 1 - 0.002516 * centuries - 0.0000074 * t2
  const position = MOON_POSITION_TERMS
  const latitudeTerms = MOON_LATITUDE_TERMS
  let longitudeSum = 0
  let latitudeSum = 0
  let distanceSum = 0
  for (let i = 0; i < position.d.length; i++) {
    const argument = moonArgument(position, i, angles)
    const correction = Math.pow(ecc, Math.abs(position.m[i]))
    longitudeSum += position.longitude[i] * Math.sin(argument) * correction
    distanceSum += position.distance[i] * Math.cos(argument) * correction
    latitudeSum += latitudeTerms.latitude[i] * Math.sin(moonArgument(latitudeTerms, i, angles))
      * Math.pow(ecc, Math.abs(latitudeTerms.m[i]))
  }
  // 金星、木星的长周期摄动。
  longitudeSum += 3958 * Math.sin(angles.a1 * DEG) + 1962 * Math.sin((angles.l - angles.f) * DEG)
    + 318 * Math.sin(angles.a2 * DEG)
  latitudeSum += -2235 * Math.sin(angles.l * DEG) + 382 * Math.sin(angles.a3 * DEG)
    + 175 * Math.sin((angles.a1 - angles.f) * DEG) + 175 * Math.sin((angles.a1 + angles.f) * DEG)
    + 127 * Math.sin((angles.l - angles.mp) * DEG) - 115 * Math.sin((angles.l + angles.mp) * DEG)
  const distance = 385000.56 + distanceSum * 0.001
  return {
    longitude: normalize(angles.l + longitudeSum * 1e-6),
    latitude: latitudeSum * 1e-6,
    distance,
    parallax: Math.asin(6378.14 / distance) / DEG
  }
}

/**
 * 轨道根数取自 JPL《Approximate Positions of the Planets》表 1，
 * 基准为 J2000 平黄道与平春分点，适用 1800—2050 年，速率单位为「每儒略世纪」。
 * 黄道坐标另加岁差改正（1.396971°/世纪）以归算到当日平春分点。
 */
const ELEMENTS = {
  earth: {
    semi: 1.00000261, semiRate: 0.00000562, ecc: 0.01671123, eccRate: -0.00004392,
    inc: -0.00001531, incRate: -0.01294668, node: 0, nodeRate: 0,
    peri: 102.93768193, periRate: 0.32327364, mean: 100.46457166, meanRate: 35999.37244981
  },
  mercury: {
    semi: 0.38709927, semiRate: 0.00000037, ecc: 0.20563593, eccRate: 0.00001906,
    inc: 7.00497902, incRate: -0.00594749, node: 48.33076593, nodeRate: -0.12534081,
    peri: 77.45779628, periRate: 0.16047689, mean: 252.25032350, meanRate: 149472.67411175
  },
  venus: {
    semi: 0.72333566, semiRate: 0.00000390, ecc: 0.00677672, eccRate: -0.00004107,
    inc: 3.39467605, incRate: -0.00078890, node: 76.67984255, nodeRate: -0.27769418,
    peri: 131.60246718, periRate: 0.00268329, mean: 181.97909950, meanRate: 58517.81538729
  },
  mars: {
    semi: 1.52371034, semiRate: 0.00001847, ecc: 0.09339410, eccRate: 0.00007882,
    inc: 1.84969142, incRate: -0.00813131, node: 49.55953891, nodeRate: -0.29257343,
    peri: -23.94362959, periRate: 0.44441088, mean: -4.55343205, meanRate: 19140.30268499
  },
  jupiter: {
    semi: 5.20288700, semiRate: -0.00011607, ecc: 0.04838624, eccRate: -0.00013253,
    inc: 1.30439695, incRate: -0.00183714, node: 100.47390909, nodeRate: 0.20469106,
    peri: 14.72847983, periRate: 0.21252668, mean: 34.39644051, meanRate: 3034.74612775
  },
  saturn: {
    semi: 9.53667594, semiRate: -0.00125060, ecc: 0.05386179, eccRate: -0.00050991,
    inc: 2.48599187, incRate: 0.00193609, node: 113.66242448, nodeRate: -0.28867794,
    peri: 92.59887831, periRate: -0.41897216, mean: 49.95424423, meanRate: 1222.49362201
  }
}

const PLANETS = [
  { key: 'mercury', name: '水星', magnitude: -0.13, phaseRate: 0.026 },
  { key: 'venus', name: '金星', magnitude: -4.37, phaseRate: 0.013 },
  { key: 'mars', name: '火星', magnitude: -1.52, phaseRate: 0.016 },
  { key: 'jupiter', name: '木星', magnitude: -9.40, phaseRate: 0.005 },
  { key: 'saturn', name: '土星', magnitude: -8.95, phaseRate: 0.044 }
]

const PRECESSION_PER_CENTURY = 1.396971177
const OBLIQUITY_J2000 = 23.4392911

function keplerAnomaly(meanAnomaly, ecc) {
  const m = normalize(meanAnomaly) * DEG
  let anomaly = m + ecc * Math.sin(m)
  for (let step = 0; step < 12; step++) {
    const delta = (anomaly - ecc * Math.sin(anomaly) - m) / (1 - ecc * Math.cos(anomaly))
    anomaly -= delta
    if (Math.abs(delta) < 1e-11) break
  }
  return anomaly
}

function heliocentricVector(key, centuries) {
  const el = ELEMENTS[key]
  const semi = el.semi + el.semiRate * centuries
  const ecc = el.ecc + el.eccRate * centuries
  const inc = (el.inc + el.incRate * centuries) * DEG
  const node = (el.node + el.nodeRate * centuries) * DEG
  const peri = el.peri + el.periRate * centuries
  const argument = (peri - (el.node + el.nodeRate * centuries)) * DEG
  const anomaly = keplerAnomaly(el.mean + el.meanRate * centuries - peri, ecc)
  const xv = semi * (Math.cos(anomaly) - ecc)
  const yv = semi * Math.sqrt(1 - ecc * ecc) * Math.sin(anomaly)
  const cosArgument = Math.cos(argument)
  const sinArgument = Math.sin(argument)
  const cosNode = Math.cos(node)
  const sinNode = Math.sin(node)
  const cosInc = Math.cos(inc)
  const sinInc = Math.sin(inc)
  return {
    x: xv * (cosArgument * cosNode - sinArgument * sinNode * cosInc)
      - yv * (sinArgument * cosNode + cosArgument * sinNode * cosInc),
    y: xv * (cosArgument * sinNode + sinArgument * cosNode * cosInc)
      + yv * (cosArgument * cosNode * cosInc - sinArgument * sinNode),
    z: xv * sinArgument * sinInc + yv * cosArgument * sinInc,
    sunDistance: Math.hypot(xv, yv)
  }
}

function planetGeocentric(key, centuries) {
  const earth = heliocentricVector('earth', centuries)
  const body = heliocentricVector(key, centuries)
  const gx = body.x - earth.x
  const gy = body.y - earth.y
  const gz = body.z - earth.z
  const earthDistance = Math.hypot(gx, gy, gz)
  return {
    longitude: normalize(Math.atan2(gy, gx) / DEG + PRECESSION_PER_CENTURY * centuries),
    latitude: Math.atan2(gz, Math.hypot(gx, gy)) / DEG,
    sunDistance: body.sunDistance,
    earthDistance
  }
}

export const STAR_CATALOG = [
  { name: '北斗一·天枢', en: 'Dubhe', right: 165.932, decl: 61.751, magnitude: 1.79, asterism: '北斗七星', mansion: '', symbol: '紫微垣' },
  { name: '北斗五·玉衡', en: 'Alioth', right: 193.507, decl: 55.96, magnitude: 1.76, asterism: '北斗七星', mansion: '', symbol: '紫微垣' },
  { name: '北斗七·摇光', en: 'Alkaid', right: 206.885, decl: 49.313, magnitude: 1.86, asterism: '北斗七星', mansion: '', symbol: '紫微垣' },
  { name: '勾陈一·北极星', en: 'Polaris', right: 37.954, decl: 89.264, magnitude: 1.97, asterism: '勾陈', mansion: '', symbol: '紫微垣' },
  { name: '织女一', en: 'Vega', right: 279.234, decl: 38.784, magnitude: 0.03, asterism: '织女', mansion: '牛', symbol: '北方玄武' },
  { name: '河鼓二', en: 'Altair', right: 297.696, decl: 8.868, magnitude: 0.77, asterism: '河鼓', mansion: '牛', symbol: '北方玄武' },
  { name: '天津四', en: 'Deneb', right: 310.358, decl: 45.28, magnitude: 1.25, asterism: '天津', mansion: '女', symbol: '北方玄武' },
  { name: '虚宿一', en: 'Beta Aquarii', right: 323.656, decl: -5.568, magnitude: 2.9, asterism: '虚宿', mansion: '虚', symbol: '北方玄武' },
  { name: '室宿一', en: 'Markab', right: 346.19, decl: 15.205, magnitude: 2.49, asterism: '室宿', mansion: '室', symbol: '北方玄武' },
  { name: '壁宿二', en: 'Alpheratz', right: 2.097, decl: 29.09, magnitude: 2.06, asterism: '壁宿', mansion: '壁', symbol: '北方玄武' },
  { name: '北落师门', en: 'Fomalhaut', right: 344.413, decl: -29.622, magnitude: 1.16, asterism: '北落师门', mansion: '室', symbol: '北方玄武' },
  { name: '角宿一', en: 'Spica', right: 201.298, decl: -11.161, magnitude: 0.97, asterism: '角宿', mansion: '角', symbol: '东方青龙' },
  { name: '南门二', en: 'Alpha Centauri', right: 219.896, decl: -60.835, magnitude: -0.27, asterism: '南门', mansion: '角', symbol: '东方青龙' },
  { name: '心宿二', en: 'Antares', right: 247.352, decl: -26.432, magnitude: 1.09, asterism: '心宿', mansion: '心', symbol: '东方青龙' },
  { name: '尾宿八', en: 'Shaula', right: 263.402, decl: -37.104, magnitude: 1.62, asterism: '尾宿', mansion: '尾', symbol: '东方青龙' },
  { name: '五车二', en: 'Capella', right: 79.172, decl: 45.998, magnitude: 0.08, asterism: '五车', mansion: '毕', symbol: '西方白虎' },
  { name: '昴宿六', en: 'Alcyone', right: 56.871, decl: 24.105, magnitude: 2.87, asterism: '昴星团', mansion: '昴', symbol: '西方白虎' },
  { name: '毕宿五', en: 'Aldebaran', right: 68.98, decl: 16.509, magnitude: 0.85, asterism: '毕宿', mansion: '毕', symbol: '西方白虎' },
  { name: '参宿七', en: 'Rigel', right: 78.634, decl: -8.202, magnitude: 0.13, asterism: '参宿', mansion: '参', symbol: '西方白虎' },
  { name: '参宿四', en: 'Betelgeuse', right: 88.793, decl: 7.407, magnitude: 0.5, asterism: '参宿', mansion: '参', symbol: '西方白虎' },
  { name: '井宿三', en: 'Alhena', right: 99.428, decl: 16.399, magnitude: 1.93, asterism: '井宿', mansion: '井', symbol: '南方朱雀' },
  { name: '南河三', en: 'Procyon', right: 114.826, decl: 5.225, magnitude: 0.34, asterism: '南河', mansion: '井', symbol: '南方朱雀' },
  { name: '天狼', en: 'Sirius', right: 101.287, decl: -16.716, magnitude: -1.46, asterism: '天狼', mansion: '井', symbol: '南方朱雀' },
  { name: '老人', en: 'Canopus', right: 95.988, decl: -52.696, magnitude: -0.74, asterism: '老人', mansion: '井', symbol: '南方朱雀' },
  { name: '轩辕十四', en: 'Regulus', right: 152.093, decl: 11.967, magnitude: 1.35, asterism: '轩辕', mansion: '星', symbol: '南方朱雀' },
  { name: '大角', en: 'Arcturus', right: 213.915, decl: 19.182, magnitude: -0.05, asterism: '大角', mansion: '', symbol: '太微垣' }
]

const PHASE_NAMES = [
  { limit: 12.5, name: '朔月', hint: '与日同升同落，整夜不可见' },
  { limit: 78.75, name: '蛾眉月', hint: '日落后见于西方低空' },
  { limit: 101.25, name: '上弦月', hint: '上半夜可见，午夜西沉' },
  { limit: 168.75, name: '盈凸月', hint: '入夜即高悬，后半夜西落' },
  { limit: 191.25, name: '望月', hint: '日落东升，彻夜照明' },
  { limit: 258.75, name: '亏凸月', hint: '入夜东升，黎明仍高悬' },
  { limit: 281.25, name: '下弦月', hint: '后半夜见于南方，清晨近西' },
  { limit: 347.5, name: '残月', hint: '黎明前见于东方低空' },
  { limit: 360, name: '朔月', hint: '与日同升同落，整夜不可见' }
]

export function formatClock(date) {
  if (!date) return '—'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function directionName(azimuth) {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return labels[Math.round(azimuth / 45) % 8]
}

function interpolateCrossing(before, after, beforeAltitude, afterAltitude, level) {
  const span = afterAltitude - beforeAltitude
  if (Math.abs(span) < 1e-9) return after
  const ratio = (level - beforeAltitude) / span
  return new Date(before.getTime() + ratio * (after.getTime() - before.getTime()))
}

function crossings(altitudes, times, level) {
  const found = []
  for (let index = 1; index < altitudes.length; index++) {
    const previous = altitudes[index - 1]
    const value = altitudes[index]
    if ((previous < level) !== (value < level)) {
      found.push({
        time: interpolateCrossing(times[index - 1], times[index], previous, value, level),
        rising: value > previous
      })
    }
  }
  return found
}

/**
 * 在一夜（本地正午至次日正午）的采样序列里求升降与时中。
 * 窗口从正午开始，故升/落未必同序：startsUp 为真时落在今夜、升在次晨。
 */
function traceArc(altitudes, times) {
  const zero = crossings(altitudes, times, 0)
  let transit = times[0]
  let peak = -90
  let lowest = 90
  for (let index = 0; index < altitudes.length; index++) {
    if (altitudes[index] > peak) {
      peak = altitudes[index]
      transit = times[index]
    }
    if (altitudes[index] < lowest) lowest = altitudes[index]
  }
  return {
    rise: zero.find(item => item.rising)?.time ?? null,
    set: zero.find(item => !item.rising)?.time ?? null,
    transit,
    peak,
    lowest,
    startsUp: altitudes[0] >= 0,
    circumpolar: lowest > 0,
    neverUp: peak <= 0
  }
}

function moonState(date, eps) {
  const ecliptic = moonEcliptic(date)
  const sun = sunEcliptic(date)
  const equatorial = eclipticToEquatorial(ecliptic.longitude, ecliptic.latitude, eps)
  const elongation = Math.acos(
    Math.max(-1, Math.min(1, Math.cos(ecliptic.latitude * DEG) * Math.cos((ecliptic.longitude - sun.longitude) * DEG)))
  ) / DEG
  const signed = normalize(ecliptic.longitude - sun.longitude)
  const phase = PHASE_NAMES.find(item => signed < item.limit)
  return {
    ...equatorial,
    eclipticLongitude: ecliptic.longitude,
    eclipticLatitude: ecliptic.latitude,
    parallax: ecliptic.parallax,
    elongation: signed,
    illumination: (1 - Math.cos(elongation * DEG)) / 2,
    waxing: signed < 180,
    phaseName: phase.name,
    phaseHint: phase.hint,
    distance: ecliptic.distance
  }
}

function planetState(planet, centuries, sunLongitude, eps) {
  const position = planetGeocentric(planet.key, centuries)
  const equatorial = eclipticToEquatorial(position.longitude, position.latitude, eps)
  const elongation = normalize(position.longitude - sunLongitude)
  const phaseAngle = Math.acos(Math.max(-1, Math.min(1,
    (position.sunDistance * position.sunDistance + position.earthDistance * position.earthDistance - 1)
      / (2 * position.sunDistance * position.earthDistance)
  ))) / DEG
  return {
    key: planet.key,
    name: planet.name,
    kind: 'planet',
    ...equatorial,
    eclipticLongitude: position.longitude,
    eclipticLatitude: position.latitude,
    magnitude: planet.magnitude + 5 * Math.log10(position.sunDistance * position.earthDistance)
      + planet.phaseRate * phaseAngle,
    elongation,
    earthDistance: position.earthDistance,
    sunDistance: position.sunDistance,
    note: planetNote(planet.key, elongation)
  }
}

function planetNote(key, elongation) {
  const eastern = elongation < 180
  if (key === 'mercury' || key === 'venus') {
    if (elongation < 12 || elongation > 348) return '近合日，隐入日光'
    const label = key === 'venus' ? '金星' : '水星'
    return eastern ? `${label}东见，昏见于西方` : `${label}西见，晨见于东方`
  }
  if (Math.abs(elongation - 180) < 15) return '接近冲日，整夜可见'
  if (elongation < 60 || elongation > 300) return '近日而行，低空短暂'
  return eastern ? '日落后见于西方夜空' : '日出前见于东方夜空'
}

function skyScore(sunElevation, moonElevation, moonIllumination, bestTargetAltitude) {
  let darkness
  let darknessLabel
  if (sunElevation >= -6) {
    darkness = 8
    darknessLabel = '天光未退'
  } else if (sunElevation >= -12) {
    darkness = 42
    darknessLabel = '民用昏影'
  } else if (sunElevation >= -18) {
    darkness = 72
    darknessLabel = '航海昏影'
  } else {
    darkness = 100
    darknessLabel = '天文黑夜'
  }
  const moonInterference = moonElevation > 0 ? moonIllumination * (moonElevation > 40 ? 42 : 26) : 0
  const moonPenalty = Math.round(moonInterference)
  const horizonBonus = Math.round(Math.max(0, Math.min(1, bestTargetAltitude / 60)) * 12)
  const total = Math.max(4, Math.min(99, Math.round(darkness * 0.62 + (100 - moonPenalty) * 0.26 + horizonBonus)))
  const label = total >= 80 ? '极佳' : total >= 62 ? '良好' : total >= 42 ? '一般' : '不宜观测'
  return {
    total,
    label,
    darkness,
    darknessLabel,
    moonPenalty,
    horizonBonus,
    factors: [
      { name: '天光', value: darkness, note: `太阳高度 ${sunElevation.toFixed(1)}°` },
      { name: '无月', value: 100 - moonPenalty, note: moonElevation > 0 ? `月光削减 ${moonPenalty} 分` : '此刻月未出或无月' },
      { name: '目标高度', value: Math.round(horizonBonus / 12 * 100), note: `最高目标 ${bestTargetAltitude.toFixed(1)}°` }
    ]
  }
}

export function getSkyMoment(date, latitude, longitude) {
  const centuries = daysSinceJ2000(date) / 36525
  const eps = obliquity(date)
  const sun = getSolarPosition(date, latitude, longitude)
  const moon = moonState(date, eps)
  const moonHorizontal = equatorialToHorizontal(moon.right, moon.decl, date, latitude, longitude, moon.parallax)
  const sunLongitude = sunEcliptic(date).longitude

  const bodies = [
    {
      key: 'sun',
      name: '太阳',
      kind: 'luminary',
      magnitude: -26.7,
      azimuth: sun.azimuth,
      elevation: sun.elevation,
      note: sun.elevation >= -6 ? '天光主导' : sun.elevation >= -18 ? '昏影中' : '已沉入地平线下'
    },
    {
      key: 'moon',
      name: '月亮',
      kind: 'luminary',
      magnitude: -12.7 + 5 * moon.illumination,
      azimuth: moonHorizontal.azimuth,
      elevation: moonHorizontal.elevation,
      phaseName: moon.phaseName,
      phaseHint: moon.phaseHint,
      illumination: moon.illumination,
      waxing: moon.waxing,
      elongation: moon.elongation,
      distance: moon.distance,
      note: `${moon.phaseName} · 照明度 ${Math.round(moon.illumination * 100)}%`
    },
    ...PLANETS.map(planet => {
      const state = planetState(planet, centuries, sunLongitude, eps)
      const horizontal = equatorialToHorizontal(state.right, state.decl, date, latitude, longitude)
      return { ...state, azimuth: horizontal.azimuth, elevation: horizontal.elevation }
    }),
    ...STAR_CATALOG.map(star => {
      const position = precessToOfDate(star.right, star.decl, centuries, eps)
      const horizontal = equatorialToHorizontal(position.right, position.decl, date, latitude, longitude)
      return {
        ...star,
        kind: 'star',
        right: position.right,
        decl: position.decl,
        azimuth: horizontal.azimuth,
        elevation: horizontal.elevation
      }
    })
  ].map(body => ({ ...body, direction: directionName(body.azimuth), up: body.elevation > 0 }))

  const visible = bodies.filter(body => body.kind !== 'sun' && body.elevation > 0)
  const bestTargetAltitude = visible.length ? Math.max(...visible.map(body => body.elevation)) : -90
  const score = skyScore(sun.elevation, moonHorizontal.elevation, moon.illumination, bestTargetAltitude)

  return {
    date,
    latitude,
    longitude,
    sunLongitude,
    sun,
    moon: { ...moon, ...moonHorizontal, direction: directionName(moonHorizontal.azimuth) },
    bodies,
    visible,
    score,
    eclipticPath: buildEclipticPath(date, latitude, longitude, eps)
  }
}

function buildEclipticPath(date, latitude, longitude, eps) {
  const segments = []
  let current = null
  for (let index = 0; index <= 120; index++) {
    const longitudeOnEcliptic = index * 3
    const equatorial = eclipticToEquatorial(longitudeOnEcliptic, 0, eps)
    const horizontal = equatorialToHorizontal(equatorial.right, equatorial.decl, date, latitude, longitude)
    if (horizontal.elevation > 0) {
      if (!current) {
        current = []
        segments.push(current)
      }
      current.push({ longitude: longitudeOnEcliptic, azimuth: horizontal.azimuth, elevation: horizontal.elevation })
    } else {
      current = null
    }
  }
  return segments.filter(segment => segment.length > 1)
}

export function getNightForecast(dateStr, latitude, longitude) {
  const start = new Date(`${dateStr}T12:00:00`)
  const times = Array.from({ length: SAMPLE_COUNT }, (_, index) => new Date(start.getTime() + index * SAMPLE_STEP_MS))
  const middle = times[Math.floor(SAMPLE_COUNT / 2)]
  const centuries = daysSinceJ2000(middle) / 36525
  const eps = obliquity(middle)
  const sunAltitudes = times.map(time => getSolarPosition(time, latitude, longitude).elevation)
  const sunLongitude = sunEcliptic(middle).longitude

  const horizon = crossings(sunAltitudes, times, 0)
  const astronomical = crossings(sunAltitudes, times, -18)
  const civil = crossings(sunAltitudes, times, -6)
  const planets = PLANETS.map(planet => planetState(planet, centuries, sunLongitude, eps))

  const arcs = [
    { key: 'sun', name: '太阳', kind: 'luminary', arc: traceArc(sunAltitudes, times) },
    {
      key: 'moon',
      name: '月亮',
      kind: 'luminary',
      arc: traceArc(times.map(time => {
        const state = moonState(time, eps)
        return equatorialToHorizontal(state.right, state.decl, time, latitude, longitude, state.parallax).elevation
      }), times)
    },
    ...planets.map(planet => ({
      key: planet.key,
      name: planet.name,
      kind: 'planet',
      magnitude: planet.magnitude,
      note: planet.note,
      arc: traceArc(times.map(time => equatorialToHorizontal(planet.right, planet.decl, time, latitude, longitude).elevation), times)
    })),
    ...STAR_CATALOG.map(star => {
      const position = precessToOfDate(star.right, star.decl, centuries, eps)
      return {
        key: star.name,
        name: star.name,
        kind: 'star',
        magnitude: star.magnitude,
        decl: position.decl,
        mansion: star.mansion,
        symbol: star.symbol,
        arc: traceArc(times.map(time => equatorialToHorizontal(position.right, position.decl, time, latitude, longitude).elevation), times)
      }
    })
  ]

  return {
    dateStr,
    sunset: horizon.find(item => !item.rising)?.time ?? null,
    dusk: civil.find(item => !item.rising)?.time ?? null,
    darkStart: astronomical.find(item => !item.rising)?.time ?? null,
    darkEnd: astronomical.filter(item => item.rising).pop()?.time ?? null,
    sunrise: horizon.filter(item => item.rising).pop()?.time ?? null,
    arcs
  }
}

export function describePosition(body) {
  if (!body) return '—'
  if (body.elevation <= -0.5) return '地平线下'
  if (body.elevation < 8) return `${body.direction}方低空，易受遮挡`
  return `${body.direction}方 ${body.elevation.toFixed(0)}°高`
}
