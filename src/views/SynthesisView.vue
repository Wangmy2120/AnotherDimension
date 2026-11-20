<script setup>
import HomeAiConclusion from '../components/HomeAiConclusion.vue'
import { chapterByKey } from '../data/chapters.js'

const chapter = chapterByKey.synthesis
</script>

<template>
  <div class="synthesis-view">
    <div class="synthesis-topline">
      <a class="back-home" href="#/">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" /></svg>
        <span>返回今日</span>
      </a>
      <p class="case-code">{{ chapter.number }} / {{ chapter.code }}</p>
    </div>
    <HomeAiConclusion />
  </div>
</template>

<style scoped>
.synthesis-view { min-height: 100vh; }
.synthesis-topline { display: flex; padding: 24px clamp(24px, 6vw, 80px) 0; align-items: center; justify-content: space-between; gap: 20px; }
</style>
