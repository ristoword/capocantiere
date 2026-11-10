import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error modulo JS senza tipi
import { createAiMiddleware } from './server/aiProxy.mjs'

function aiProxy(mode: string): Plugin {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const middleware = createAiMiddleware(env)
  return {
    name: 'capocantiere-ai-proxy',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), aiProxy(mode)],
  server: { port: 5173, strictPort: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
