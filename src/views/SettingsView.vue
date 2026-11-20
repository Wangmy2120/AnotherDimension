<script setup>
import { reactive, ref } from 'vue'
import { store } from '../store.js'
import { DEFAULT_SETTINGS } from '../lib/ai.js'

const form = reactive({ ...store.settings })
const saved = ref(false)
const showKey = ref(false)

function save() {
  store.settings = { ...form, baseUrl: form.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl, model: form.model.trim() || DEFAULT_SETTINGS.model }
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}
</script>

<template>
  <div>
    <div class="card">
      <div class="card-title">AI 解读配置</div>
      <p class="muted small" style="line-height: 1.8; margin-bottom: 12px">
        默认使用 DeepSeek 开放平台接口（兼容 OpenAI 格式，可换任意兼容服务）。
        Key 仅保存在你的浏览器本地，直接从浏览器调用接口。
      </p>
      <div class="kv" style="border: none; flex-direction: column; align-items: stretch; gap: 6px">
        <span class="k">API Key</span>
        <div class="row">
          <input :type="showKey ? 'text' : 'password'" v-model="form.apiKey" placeholder="sk-..." style="flex: 1">
          <button class="btn ghost small" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
        </div>
      </div>
      <div class="kv" style="border: none; flex-direction: column; align-items: stretch; gap: 6px">
        <span class="k">接口地址</span>
        <input v-model="form.baseUrl" placeholder="https://api.deepseek.com">
      </div>
      <div class="kv" style="border: none; flex-direction: column; align-items: stretch; gap: 6px">
        <span class="k">模型</span>
        <input v-model="form.model" placeholder="deepseek-chat">
      </div>
      <button class="btn" style="margin-top: 12px" @click="save">{{ saved ? '已保存 ✓' : '保存配置' }}</button>
    </div>

    <div class="card">
      <div class="card-title">关于本工具</div>
      <p class="muted" style="line-height: 2">
        「天机历」是一款传统文化体验工具，融合《周易》六十四卦、传统黄历、二十八宿值日与八字五行民俗，
        所有内容仅供娱乐参考。历法数据由开源库 lunar-typescript 推算，卦爻辞取自公版《周易》原文。
      </p>
      <p class="muted" style="line-height: 2; margin-top: 8px">
        古人云：「积善之家，必有余庆。」运势之说，贵在劝人向善、顺势而为，切勿迷信。
      </p>
    </div>
  </div>
</template>
