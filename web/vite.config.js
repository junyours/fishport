import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  server: { fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../mobile/i18n', import.meta.url))] } },
  plugins: [
    react({ jsxImportSource: '/src/i18n' }),
    {
      name: 'local-language-runtime',
      configResolved(config) {
        // Keep the local JSX runtime in Vite's source graph. Prebundling it
        // as a dependency would create a separate copy of the language store.
        config.optimizeDeps.include = (config.optimizeDeps.include || [])
          .filter((id) => !id.startsWith('/src/i18n/'))
      },
    },
  ],
  optimizeDeps: { exclude: ['/src/i18n/jsx-runtime', '/src/i18n/jsx-dev-runtime'] },
})
