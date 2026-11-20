import hexagrams from '../data/hexagrams.json'

const NATURE = { 乾: '天', 坤: '地', 震: '雷', 巽: '风', 坎: '水', 离: '火', 艮: '山', 兑: '泽' }

const byCode = new Map(hexagrams.map(h => [h.array.join(''), h]))

export function fullName(h) {
  if (h.name === '习坎') return '坎为水'
  const [lower, upper] = h.combination
  if (lower === upper) return `${lower}为${NATURE[lower]}`
  return `${NATURE[upper]}${NATURE[lower]}${h.name}`
}

function randInt(n) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

// 三枚铜钱：背面3、正面2，六爻自下而上
export function tossOne() {
  const coins = [randInt(2) + 2, randInt(2) + 2, randInt(2) + 2]
  const value = coins.reduce((a, b) => a + b, 0)
  return {
    coins,
    value,
    yang: value === 7 || value === 9,
    moving: value === 6 || value === 9,
    label: { 6: '老阴 ⚋×', 7: '少阳 ⚊', 8: '少阴 ⚋', 9: '老阳 ⚊○' }[value]
  }
}

export function buildResult(lines) {
  const primaryCode = lines.map(l => (l.yang ? 1 : 0)).join('')
  const changedCode = lines.map(l => (l.moving ? (l.yang ? 0 : 1) : l.yang ? 1 : 0)).join('')
  const primary = byCode.get(primaryCode)
  const changed = byCode.get(changedCode)
  const movingIdx = lines.map((l, i) => (l.moving ? i : -1)).filter(i => i >= 0)

  let movingTexts = []
  if (movingIdx.length === 6 && primary.name === '乾') {
    movingTexts = [{ name: '用九', scripture: primary.lines[6].scripture }]
  } else if (movingIdx.length === 6 && primary.name === '坤') {
    movingTexts = [{ name: '用六', scripture: primary.lines[6].scripture }]
  } else {
    movingTexts = movingIdx.map(i => ({ name: primary.lines[i].name, scripture: primary.lines[i].scripture }))
  }

  return {
    lines,
    primary,
    changed: movingIdx.length ? changed : null,
    primaryName: fullName(primary),
    changedName: movingIdx.length ? fullName(changed) : null,
    movingIdx,
    movingTexts
  }
}

export function hexagramByCode(code) {
  return byCode.get(code)
}

export { hexagrams, fullName as hexFullName }