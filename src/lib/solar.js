const DEG = Math.PI / 180

function normalize(value, cycle) {
  return ((value % cycle) + cycle) % cycle
}

function equationOfTime(date) {
  const year = date.getUTCFullYear()
  const day = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const gamma = 2 * Math.PI / 365 * (day - 1 + (hour - 12) / 24)
  return 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
}

export function getTrueSolarTime(date, longitude) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes()
    + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000
  const offset = equationOfTime(date) + longitude * 4
  return normalize(utcMinutes + offset, 1440)
}

export function formatSolarTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.floor(totalMinutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function getSolarPosition(date, latitude, longitude) {
  const julianDay = date.getTime() / 86400000 + 2440587.5
  const days = julianDay - 2451545
  const meanLongitude = normalize(280.46 + 0.9856474 * days, 360) * DEG
  const meanAnomaly = normalize(357.528 + 0.9856003 * days, 360) * DEG
  const eclipticLongitude = meanLongitude + (1.915 * Math.sin(meanAnomaly)
    + 0.02 * Math.sin(2 * meanAnomaly)) * DEG
  const obliquity = (23.439 - 0.0000004 * days) * DEG
  const rightAscension = normalize(Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude)
  ) / DEG, 360)
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  const sidereal = normalize(280.46061837 + 360.98564736629 * days + longitude, 360)
  let hourAngle = normalize(sidereal - rightAscension, 360)
  if (hourAngle > 180) hourAngle -= 360
  hourAngle *= DEG

  const lat = latitude * DEG
  const elevation = Math.asin(
    Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)
  ) / DEG
  const azimuth = normalize(Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat)
  ) / DEG + 180, 360)

  return { azimuth, elevation }
}
