<script setup>
import { computed } from 'vue'
import { dayInfo } from '../store.js'
import DateBar from '../components/DateBar.vue'

const info = computed(() => dayInfo())
</script>

<template>
  <div>
    <DateBar />
    <div class="card">
      <div class="card-title">历法干支</div>
      <div class="kv"><span class="k">公历</span><span>{{ info.dateStr }} 星期{{ info.week }}</span></div>
      <div class="kv"><span class="k">农历</span><span>{{ info.lunarText }}（{{ info.shengXiao }}年）</span></div>
      <div class="kv"><span class="k">干支</span><span>{{ info.yearGanZhi }}年 {{ info.monthGanZhi }}月 {{ info.dayGanZhi }}日</span></div>
      <div class="kv"><span class="k">节气</span><span>{{ info.prevJie.name }}（{{ info.prevJie.date }}）→ {{ info.nextJie.name }}（{{ info.nextJie.date }}）</span></div>
      <div class="kv"><span class="k">彭祖百忌</span><span>{{ info.pengZu.join('；') }}</span></div>
    </div>

    <div class="card">
      <div class="card-title">宜</div>
      <span class="tag yi" v-for="t in info.yi" :key="t">{{ t }}</span>
    </div>
    <div class="card">
      <div class="card-title">忌</div>
      <span class="tag ji" v-for="t in info.ji" :key="t">{{ t }}</span>
    </div>

    <div class="card">
      <div class="card-title">冲煞与吉神</div>
      <div class="kv"><span class="k">冲煞</span><span>冲{{ info.chong }} · 煞{{ info.sha }}</span></div>
      <div class="kv"><span class="k">吉神宜趋</span><span>{{ info.jiShen.join('、') || '—' }}</span></div>
      <div class="kv"><span class="k">凶煞宜忌</span><span>{{ info.xiongSha.join('、') || '—' }}</span></div>
      <div class="kv"><span class="k">喜神方位</span><span>{{ info.positions.xi }}</span></div>
      <div class="kv"><span class="k">财神方位</span><span>{{ info.positions.cai }}</span></div>
      <div class="kv"><span class="k">福神方位</span><span>{{ info.positions.fu }}</span></div>
    </div>

    <div class="card">
      <div class="card-title">二十八宿值日</div>
      <div class="spread">
        <span style="font-size: 18px">{{ info.xiu }}</span>
        <span class="tag" :class="info.xiuLuck === '吉' ? 'yi' : 'ji'">{{ info.xiuName }} · {{ info.xiuLuck }}</span>
      </div>
      <p class="muted" style="margin-top: 12px; line-height: 2">{{ info.xiuSong }}</p>
    </div>
  </div>
</template>