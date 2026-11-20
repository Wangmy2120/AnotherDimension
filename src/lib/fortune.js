import { relationOf, RELATION_DESC, SHENG } from './calendar.js'

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const BASE = {
  career: { 生我: 88, 比和: 80, 我生: 74, 我克: 70, 克我: 62 },
  wealth: { 我克: 88, 我生: 80, 生我: 70, 比和: 66, 克我: 58 },
  love: { 生我: 84, 比和: 82, 我生: 76, 我克: 72, 克我: 68 },
  health: { 生我: 88, 比和: 84, 我克: 72, 我生: 66, 克我: 56 }
}

export const CATEGORY_META = {
  career: { name: '事业', icon: '📜' },
  wealth: { name: '财运', icon: '🪙' },
  love: { name: '感情', icon: '🏮' },
  health: { name: '健康', icon: '🍵' }
}

const TIPS = {
  career: [
    '宜低调蓄力，琐事缠身不必强出头，把手头事做扎实即是进境。',
    '稳中有小阻，重要决策不妨缓一日，多听少说可避口舌。',
    '运势平稳，按部就班推进即可，午后思路渐开，宜处理文书。',
    '气场顺遂，贵人暗助，适合汇报、面试、推进关键事项。',
    '如日方升，才华得展，大胆争取机会，长辈上司多有助力。'
  ],
  wealth: [
    '财气宜守不宜攻，捂紧钱袋，远离冲动消费与借贷担保。',
    '进财平平，正财尚可，偏财莫贪，账目宜清。',
    '财运中和，劳有所得，适合整理财务、规划开支。',
    '财星渐旺，正财稳中有升，谈判议价可占先机。',
    '财气亨通，求财得利，把握眼前机会，但忌贪多务得。'
  ],
  love: [
    '心绪易燥，言语宜柔，误会多因小事起，退一步海阔天空。',
    '缘分平淡，不必强求进展，独处读书亦是滋养。',
    '感情平顺，适合陪伴家人、问候旧友，细水长流。',
    '人缘渐佳，单身者留意身边善意，有伴者宜坦诚小叙。',
    '桃花映日，心意易通，宜表白、约会、化解前嫌。'
  ],
  health: [
    '气场稍克，宜早歇息，忌熬夜劳神，热汤暖饭最养人。',
    '精力微泄，量力而行，散步舒展胜过剧烈运动。',
    '身心平和，饮食有节、起居有常即是养生。',
    '气机顺畅，适合户外活动，晒背散步皆宜。',
    '神采奕奕，气血和畅，宜舒展筋骨、亲近草木。'
  ]
}

const WX_COLOR = { 木: '青绿', 火: '朱红', 土: '黄棕', 金: '素白', 水: '玄蓝' }
const WX_NUM = { 木: [3, 8], 火: [2, 7], 土: [5, 10], 金: [4, 9], 水: [1, 6] }
const WX_DIR = { 木: '正东', 火: '正南', 土: '西南', 金: '正西', 水: '正北' }

export function getFortune(dayInfo, bazi, gender) {
  const dateStr = dayInfo.dateStr
  const envWx = dayInfo.dayWuXing
  const meWx = bazi ? bazi.dayMasterWuXing : null
  const relation = meWx ? relationOf(envWx, meWx) : null

  const categories = {}
  for (const key of Object.keys(BASE)) {
    let score
    if (relation) {
      score = BASE[key][relation]
      if (key === 'love' && gender === 'male' && relation === '我克') score += 8
      if (key === 'love' && gender === 'female' && relation === '克我') score += 10
    } else {
      score = 72
    }
    score += (hash(`${dateStr}|${meWx || 'anon'}|${key}`) % 15) - 7
    score = Math.max(40, Math.min(98, score))
    const stars = Math.max(1, Math.min(5, Math.round(score / 20)))
    categories[key] = { ...CATEGORY_META[key], score, stars, tip: TIPS[key][stars - 1] }
  }

  const overall = Math.round(Object.values(categories).reduce((a, c) => a + c.score, 0) / 4)
  const luckyWx = meWx ? Object.keys(SHENG).find(k => SHENG[k] === meWx) : envWx
  const nums = WX_NUM[luckyWx]

  return {
    relation,
    relationDesc: relation ? RELATION_DESC[relation] : '录入生辰八字后，可依据当日干支与你日主的五行生克，生成个性化运势。',
    categories,
    overall,
    overallStars: Math.max(1, Math.min(5, Math.round(overall / 20))),
    lucky: {
      color: WX_COLOR[luckyWx],
      number: nums[hash(dateStr + luckyWx) % 2],
      direction: WX_DIR[luckyWx],
      wuXing: luckyWx
    },
    personalized: !!meWx
  }
}