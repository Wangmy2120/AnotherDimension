export const chapters = [
  {
    key: 'home',
    label: '今日',
    code: 'ORIGIN',
    title: '观天象，定此刻',
    path: '#/',
    number: null,
    group: 'origin',
    intro: false
  },
  {
    key: 'almanac',
    label: '黄历',
    code: 'ALMANAC',
    title: '因时而行',
    path: '#/almanac',
    number: '01',
    group: 'chapter',
    intro: true
  },
  {
    key: 'zeji',
    label: '择吉',
    code: 'SELECTION',
    title: '择事候时',
    path: '#/zeji',
    number: '02',
    group: 'chapter',
    intro: true
  },
  {
    key: 'fortune',
    label: '运势',
    code: 'TENDENCY',
    title: '观势知止',
    path: '#/fortune',
    number: '03',
    group: 'chapter',
    intro: true
  },
  {
    key: 'bazi',
    label: '八字',
    code: 'NATAL',
    title: '由命见性',
    path: '#/bazi',
    number: '04',
    group: 'chapter',
    intro: true
  },
  {
    key: 'gua',
    label: '摇卦',
    code: 'DIVINATION',
    title: '以问观变',
    path: '#/gua',
    number: '05',
    group: 'chapter',
    intro: true
  },
  {
    key: 'dream',
    label: '解梦',
    code: 'ONEIRIC',
    title: '循梦观心',
    path: '#/dream',
    number: '06',
    group: 'chapter',
    intro: true
  },
  {
    key: 'synthesis',
    label: '合参',
    code: 'SYNTHESIS',
    title: '万轨归一',
    path: '#/synthesis',
    number: '07',
    group: 'conclusion',
    intro: false
  },
  {
    key: 'settings',
    label: '设置',
    code: 'UTILITY',
    title: '偏好与隐私',
    path: '#/settings',
    number: null,
    group: 'utility',
    intro: true
  }
]

export const chapterByKey = Object.fromEntries(chapters.map(chapter => [chapter.key, chapter]))
export const readingChapters = chapters.filter(chapter => chapter.group === 'chapter' || chapter.group === 'conclusion')
export const sixChapters = chapters.filter(chapter => chapter.group === 'chapter')

export function chapterFromHash(hash) {
  const normalized = !hash || hash === '#' ? '#/' : hash
  return chapters.find(chapter => chapter.path === normalized) || chapterByKey.home
}

export function chapterPath(key) {
  return chapterByKey[key]?.path || '#/'
}

export function chapterLabel(chapter) {
  return chapter.number ? `${chapter.number} / ${chapter.code}` : chapter.code
}
