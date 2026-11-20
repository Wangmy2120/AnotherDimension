import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import { createInterpretHandler } from './server/ai-interpret.js'

function aiProxyPlugin(env) {
  const handleInterpret = createInterpretHandler(env)
  return {
    name: 'tianji-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/functions/v1/app/interpret', handleInterpret)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/functions/v1/app/interpret', handleInterpret)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), aiProxyPlugin(env)]
  }
})
