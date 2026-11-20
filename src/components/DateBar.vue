<script setup>
import { store } from '../store.js'
import { todayStr } from '../lib/calendar.js'

function shift(days) {
  const d = new Date(store.dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  store.dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="date-bar">
    <button class="date-shift" type="button" aria-label="查看前一日" @click="shift(-1)">前一日</button>
    <input type="date" v-model="store.dateStr" aria-label="选择日期" min="1901-01-01" max="2099-12-31">
    <button class="date-shift" type="button" aria-label="查看后一日" @click="shift(1)">后一日</button>
    <button v-if="store.dateStr !== todayStr()" class="date-today" type="button" @click="store.dateStr = todayStr()">回到今天</button>
  </div>
</template>
