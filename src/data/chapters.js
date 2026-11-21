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

// Future modules stay out of navigation until a view and loader are registered here.
export const futureChapters = [
  { key: 'folk-knowledge', label: '民俗', code: 'FOLKLORE', title: '知其所以然', path: '#/folk', group: 'future', enabled: false },
  { key: 'xiaoliuren', label: '小六壬', code: 'XIAOLIUREN', title: '按时起课', path: '#/xiaoliuren', group: 'future', enabled: false },
  { key: 'ziwei', label: '紫微斗数', code: 'ZIWEI', title: '观命于星', path: '#/ziwei', group: 'future', enabled: false },
  { key: 'xiu', label: '星宿', code: 'MANSIONS', title: '循天列宿', path: '#/mansions', group: 'future', enabled: false },
  { key: 'cezi', label: '测字', code: 'GLYPH', title: '一字见心', path: '#/cezi', group: 'future', enabled: false }
]

export const chapterByKey = Object.fromEntries(chapters.map(chapter => [chapter.key, chapter]))
export const futureChapterByKey = Object.fromEntries(futureChapters.map(chapter => [chapter.key, chapter]))
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
