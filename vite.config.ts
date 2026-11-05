import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  server: {
    proxy: {
      '/chain-api': {
        target: 'https://axone-test.api.cumulo.com.es',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/chain-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'identity-request-vendor',
              test: /node_modules\/(?:@cosmjs|cosmjs-types)\//,
              maxSize: 1024 * 1024,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
