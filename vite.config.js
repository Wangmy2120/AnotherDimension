import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { createInterpretHandler } from './server/ai-interpret.js'
import { AI_CONFIG_ENDPOINT, createAiConfig, createAiConfigHandler } from './server/ai-config.js'

function aiProxyPlugin(env) {
  const aiConfig = createAiConfig(env)
  const handleInterpret = createInterpretHandler(env, { getConfig: () => aiConfig.get() })
  const handleAiConfig = createAiConfigHandler(aiConfig)

  const register = server => {
    server.middlewares.use(AI_CONFIG_ENDPOINT, handleAiConfig)
    server.middlewares.use('/functions/v1/app/interpret', handleInterpret)
  }

  return {
    name: 'tianji-ai-proxy',
    configureServer: register,
    configurePreviewServer: register
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), aiProxyPlugin(env)]
  }
})
