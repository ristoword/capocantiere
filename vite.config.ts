import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error modulo JS senza tipi
import { createApi } from './server/api.mjs'

function aiProxy(mode: string): Plugin {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  // Il database si apre solo quando parte un server (non durante `vite build`).
  return {
    name: 'capocantiere-api',
    configureServer(server) {
      server.middlewares.use(createApi(env))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApi(env))
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), aiProxy(mode)],
  server: { port: 5173, strictPort: false },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
}))
