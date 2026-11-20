<script setup>
import { ref, computed, watch } from 'vue'
import dreams from '../data/dreams.json'
import { store, openAi } from '../store.js'

const query = ref('')
const activeCat = ref('全部')
const selected = ref(null)
watch(query, () => { selected.value = null })

const cats = ['全部', ...new Set(dreams.map(d => d.cat))]
const HOT = ['蛇', '掉牙', '飞翔', '被追赶', '考试', '洪水', '捡钱', '已故亲人', '怀孕', '棺材', '血', '自己死亡']

const results = computed(() => {
  const q = query.value.trim()
  let list = dreams
  if (activeCat.value !== '全部') list = list.filter(d => d.cat === activeCat.value)
  if (q) {
    list = list.filter(d =>
      d.keyword.includes(q) || q.includes(d.keyword) ||
      d.alias.some(a => a.includes(q) || q.includes(a)))
  }
  return list
})

function pick(d) {
  selected.value = d
}

function askAi() {
  store.dreamSession = selected.value
  openAi('dream')
}
</script>

<template>
  <div>
    <div class="card">
      <div class="card-title">周公解梦</div>
      <p class="muted" style="line-height: 1.9; margin-bottom: 12px">
        梦者，心之影也。输入梦中关键词，查传统民俗释义，亦可请 AI 结合你的近况细细道来。仅供娱乐参考。
      </p>
      <input v-model="query" placeholder="输入梦境关键词，如：蛇、掉牙、飞翔…" style="width: 100%">
      <div style="margin-top: 10px">
        <span v-for="h in HOT" :key="h" class="tag plain" style="cursor: pointer" @click="query = h; selected = null">{{ h }}</span>
      </div>
    </div>

    <div class="card" v-if="selected">
      <div class="spread">
        <span style="font-size: 19px; color: var(--cinnabar-deep); letter-spacing: 2px">梦见{{ selected.keyword }}</span>
        <span class="tag" :class="selected.luck === '吉' ? 'yi' : selected.luck === '凶' ? 'ji' : 'plain'">{{ selected.luck }}</span>
      </div>
      <p style="line-height: 2; margin-top: 10px">{{ selected.text }}</p>
      <button class="btn block" style="margin-top: 14px" @click="askAi">✦ AI 深度解梦</button>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom: 10px">
        <button v-for="c in cats" :key="c" class="btn ghost small"
          :style="activeCat === c ? 'background: var(--cinnabar); color: #fff8ee' : ''"
          style="padding: 4px 12px" @click="activeCat = c; selected = null">{{ c }}</button>
      </div>
      <p v-if="!results.length" class="muted">未找到相关梦境，换个关键词试试（如"蛇""水""飞"）。</p>
      <div v-for="d in results" :key="d.keyword" class="kv" style="cursor: pointer" @click="pick(d)">
        <span class="k" style="color: var(--ink)">{{ d.keyword }}</span>
        <span class="muted small" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ d.text }}</span>
        <span class="tag small" :class="d.luck === '吉' ? 'yi' : d.luck === '凶' ? 'ji' : 'plain'" style="margin: 0">{{ d.luck }}</span>
      </div>
    </div>
  </div>
</template>