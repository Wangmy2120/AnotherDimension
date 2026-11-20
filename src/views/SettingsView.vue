<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { sound } from '../lib/sound.js'

const clearArmed = ref(false)
const reducedMotion = ref(false)
let motionQuery

function updateMotionPreference(event) {
  reducedMotion.value = event.matches
}

function clearLocalData() {
  try {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('tianji.')) keys.push(key)
    }
    keys.forEach(key => localStorage.removeItem(key))
  } catch { /* 浏览器可能禁用本地存储 */ }
  window.location.reload()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', updateMotionPreference)
})

onBeforeUnmount(() => motionQuery?.removeEventListener('change', updateMotionPreference))
</script>

<template>
  <div class="settings-view">
    <div class="card">
      <h2 class="card-title">关于本工具</h2>
      <p class="muted settings-copy">
        「天机历」是一款传统文化体验工具，融合《周易》六十四卦、传统黄历、二十八宿值日与八字五行民俗。
        所有内容仅供文化体验与娱乐参考。
      </p>
      <p class="muted settings-copy">
        历法数据由开源库 lunar-typescript 推算，卦爻辞取自公版《周易》原文。古人云：「积善之家，必有余庆。」
        运势之说，贵在劝人向善、顺势而为，切勿迷信。
      </p>
    </div>

    <div class="card">
      <h2 class="card-title">声音与动效</h2>
      <div class="setting-row">
        <div>
          <strong>交互声音</strong>
          <p class="muted">铜钱、索引、章节切换与墨晕的合成音。</p>
        </div>
        <button class="btn ghost small" type="button" :aria-pressed="sound.enabled" @click="sound.toggle()">
          {{ sound.enabled ? '关闭声音' : '开启声音' }}
        </button>
      </div>
      <div class="setting-row">
        <div>
          <strong>动态效果</strong>
          <p class="muted">跟随系统「减少动态效果」设置，自动切换为静态星轨与静态 Hero。</p>
        </div>
        <span class="settings-state">{{ reducedMotion ? '已减少动态' : '完整动态' }}</span>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">数据与隐私</h2>
      <ul class="privacy-list">
        <li>生辰、当前解读日期、摇卦与解梦记录只保存在此浏览器。</li>
        <li>手动设置的位置只在当前会话中使用，不写入本地存储。</li>
        <li>只有你主动生成 AI 解读时，解读所需上下文才会发送给站点的同源解读服务；原始经纬度不随请求发送。</li>
        <li>项目不要求也不保存任何第三方密钥。</li>
      </ul>
      <div class="data-actions">
        <button v-if="!clearArmed" class="btn ghost small" type="button" @click="clearArmed = true">清除本地数据</button>
        <div v-else class="clear-confirm" role="alert">
          <p>将清除生辰、卦象、梦境、声音偏好等所有本地数据，无法恢复。</p>
          <div class="row">
            <button class="btn small" type="button" @click="clearLocalData">确认清除</button>
            <button class="btn ghost small" type="button" @click="clearArmed = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">来源与考据</h2>
      <p class="muted settings-copy">黄历宜忌与神煞参考《协纪辨方书》体例，八字排盘参考《渊海子平》，卦辞采用《周易》公版原文。星宿、建除与节气由 lunar-typescript 推算。</p>
    </div>

    <div class="card">
      <h2 class="card-title">免责声明</h2>
      <p class="muted settings-copy">
        本站内容不构成医疗、投资、法律或人生决策建议。命自我立，福自己求。
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings-view { display: flex; flex-direction: column; gap: 0; }
.settings-copy { line-height: 1.9; }
.settings-copy + .settings-copy { margin-top: 10px; }
.setting-row { display: flex; min-height: 74px; padding: 16px 0; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid var(--line); }
.setting-row:first-of-type { border-top: 0; padding-top: 0; }
.setting-row strong { display: block; font-size: 13px; font-weight: 400; letter-spacing: 0.08em; }
.setting-row p { margin-top: 5px; line-height: 1.7; }
.settings-state { flex: 0 0 auto; color: var(--silver); font-size: 12px; letter-spacing: 0.08em; }
.privacy-list { display: grid; gap: 9px; padding-left: 1.2em; color: var(--silver); font-size: 13px; line-height: 1.8; }
.privacy-list li::marker { color: var(--muted); content: '— '; }
.data-actions { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); }
.clear-confirm { padding: 14px 16px; border: 1px solid var(--line-strong); background: oklch(0.97 0 0 / 0.035); }
.clear-confirm p { margin-bottom: 12px; color: var(--silver); font-size: 12px; line-height: 1.8; }
@media (max-width: 520px) {
  .setting-row { align-items: flex-start; flex-direction: column; gap: 12px; }
}
</style>
