<script setup>
import { ref, watch } from 'vue'
import { store, openAi } from '../store.js'
import { tossOne, buildResult } from '../lib/hexagram.js'

const question = ref('')
const phase = ref('idle')
const lines = ref([])
const result = ref(null)
const spinning = ref(false)
const displayCoins = ref([3, 3, 3])
const round = ref(0)

function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function storageKey() {
  return `tianji.gua.${store.dateStr}.${hash(question.value.trim() || '默认')}`
}

function loadSaved() {
  if (phase.value === 'tossing') return
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()))
    if (saved && saved.length === 6) {
      lines.value = saved
      result.value = buildResult(saved)
      phase.value = 'done'
      return
    }
  } catch { /* 忽略损坏记录 */ }
  lines.value = []
  result.value = null
  phase.value = 'idle'
}

watch([() => store.dateStr, question], loadSaved, { immediate: true })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function startToss() {
  if (phase.value === 'tossing') return
  phase.value = 'tossing'
  lines.value = []
  result.value = null
  for (let i = 0; i < 6; i++) {
    round.value = i + 1
    spinning.value = true
    const flicker = setInterval(() => {
      displayCoins.value = [0, 0, 0].map(() => Math.random() < 0.5 ? 2 : 3)
    }, 120)
    await sleep(700)
    clearInterval(flicker)
    const t = tossOne()
    displayCoins.value = t.coins
    spinning.value = false
    lines.value = [...lines.value, t]
    await sleep(420)
  }
  result.value = buildResult(lines.value)
  localStorage.setItem(storageKey(), JSON.stringify(lines.value))
  phase.value = 'done'
}

function newQuestion() {
  question.value = ''
  lines.value = []
  result.value = null
  phase.value = 'idle'
}

function askAi() {
  store.hexSession = { result: result.value, question: question.value.trim() }
  openAi('hexagram')
}

const POS_NAME = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
</script>

<template>
  <div>
    <div class="card">
      <div class="card-title">周易摇卦 · 三钱法</div>
      <p class="muted" style="line-height: 1.9; margin-bottom: 12px">
        心中默念所问之事，摇动三枚铜钱，凡六次而成一卦。老阳老阴为动爻，动则生变卦。
        「初筮告，再三渎」——同一日同一事，只取初卦。
      </p>
      <input v-model="question" :disabled="phase !== 'idle'" placeholder="所问何事？（可留空，问今日整体运势）"
        style="width: 100%; margin-bottom: 12px" maxlength="40">
      <button v-if="phase === 'idle'" class="btn block" @click="startToss">☯ 诚心摇卦</button>
      <button v-if="phase === 'done'" class="btn ghost block" @click="newQuestion">另问新事</button>
    </div>

    <div v-if="phase === 'tossing'" class="card" style="text-align: center">
      <p class="muted">第 {{ round }} / 6 爻 · {{ POS_NAME[round - 1] }}</p>
      <div class="coins">
        <div v-for="(c, i) in displayCoins" :key="i" class="coin" :class="{ spinning }">
          <span>{{ spinning ? '' : (c === 3 ? '背' : '字') }}</span>
        </div>
      </div>
      <div class="yao-list" style="max-width: 320px; margin: 0 auto">
        <div v-for="(l, i) in lines" :key="i" class="yao" :class="{ moving: l.moving }">
          <span class="yao-label">{{ l.label }}</span>
          <div class="yao-bar"><div class="seg" v-if="l.yang"></div><template v-else><div class="seg"></div><div class="seg"></div></template></div>
        </div>
      </div>
    </div>

    <template v-if="phase === 'done' && result">
      <div class="card">
        <div class="spread">
          <div>
            <div style="font-size: 40px; line-height: 1">{{ result.primary.symbol }}</div>
            <div style="font-size: 20px; color: var(--cinnabar-deep); margin-top: 6px; letter-spacing: 2px">{{ result.primaryName }}</div>
          </div>
          <div v-if="result.changed" style="text-align: right">
            <div class="muted small">变卦</div>
            <div style="font-size: 32px; line-height: 1.2">{{ result.changed.symbol }}</div>
            <div style="color: var(--gold); letter-spacing: 1px">{{ result.changedName }}</div>
          </div>
          <div v-else class="muted small">六爻安静<br>以本卦卦辞断</div>
        </div>
        <div class="yao-list" style="margin-top: 14px">
          <div v-for="(l, i) in lines" :key="i" class="yao" :class="{ moving: l.moving }">
            <span class="yao-label">{{ result.primary.lines[i].name }}{{ l.moving ? ' 动' : '' }}</span>
            <div class="yao-bar"><div class="seg" v-if="l.yang"></div><template v-else><div class="seg"></div><div class="seg"></div></template></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">卦辞</div>
        <p style="line-height: 2; font-size: 16px">{{ result.primary.scripture }}</p>
      </div>

      <div class="card" v-if="result.movingTexts.length">
        <div class="card-title">动爻爻辞</div>
        <div v-for="t in result.movingTexts" :key="t.name" class="kv">
          <span class="k" style="color: var(--cinnabar)">{{ t.name }}</span>
          <span style="line-height: 1.9">{{ t.scripture }}</span>
        </div>
      </div>

      <div class="card" v-if="result.changed">
        <div class="card-title">变卦卦辞 · {{ result.changedName }}</div>
        <p style="line-height: 2">{{ result.changed.scripture }}</p>
      </div>

      <div class="card">
        <button class="btn block" @click="askAi">AI 解卦</button>
        <p class="muted small" style="margin-top: 10px; text-align: center">卦象已记入今日卦簿，同日重问同事不再重摇。</p>
      </div>
    </template>
  </div>
</template>