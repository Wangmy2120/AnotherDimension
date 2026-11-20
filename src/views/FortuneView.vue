<script setup>
import { computed } from 'vue'
import { dayInfo, fortune, openAi, store } from '../store.js'
import DateBar from '../components/DateBar.vue'

const info = computed(() => dayInfo())
const ft = computed(() => fortune())
</script>

<template>
  <div>
    <DateBar />
    <div class="card" style="text-align: center">
      <div class="muted">{{ info.dateStr }} · {{ info.dayGanZhi }}日（{{ info.dayWuXing }}）</div>
      <div style="margin: 8px 0">
        <span class="score-ring">{{ ft.overall }}</span>
        <span class="muted"> / 100</span>
      </div>
      <div class="stars" style="font-size: 20px">{{ '★'.repeat(ft.overallStars) }}{{ '☆'.repeat(5 - ft.overallStars) }}</div>
      <p v-if="ft.relation" class="muted" style="margin-top: 10px">
        日主「{{ ft.relation === '比和' ? '同气' : ft.relation }}」· 当日天干五行属{{ info.dayWuXing }}
      </p>
      <p class="muted" style="margin-top: 8px; line-height: 1.9; text-align: left">{{ ft.relationDesc }}</p>
    </div>

    <div class="card" v-for="c in ft.categories" :key="c.name">
      <div class="spread">
        <span style="font-size: 16px">{{ c.name }}</span>
        <span><span class="stars">{{ '★'.repeat(c.stars) }}{{ '☆'.repeat(5 - c.stars) }}</span> <span class="muted small">{{ c.score }}分</span></span>
      </div>
      <p class="muted" style="margin-top: 8px; line-height: 1.8">{{ c.tip }}</p>
    </div>

    <div class="card">
      <div class="card-title">开运参考</div>
      <div class="grid2">
        <div class="kv"><span class="k">幸运色</span><span>{{ ft.lucky.color }}</span></div>
        <div class="kv"><span class="k">幸运数</span><span>{{ ft.lucky.number }}</span></div>
        <div class="kv"><span class="k">吉方位</span><span>{{ ft.lucky.direction }}</span></div>
        <div class="kv"><span class="k">扶运五行</span><span>{{ ft.lucky.wuXing }}</span></div>
      </div>
      <p v-if="!ft.personalized" class="muted small" style="margin-top: 10px">
        当前为通用运势。到「八字」页录入生辰后，将按你的日主五行个性化推演。
      </p>
      <button class="btn block" style="margin-top: 14px" @click="openAi('daily')">AI 深度解读</button>
    </div>
  </div>
</template>