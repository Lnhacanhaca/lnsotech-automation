import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LNSOTECH Events CRM',
        short_name: 'LNSOTECH CRM',
        description: 'Gestor de Eventos e Lembretes',
        theme_color: '#0f172a',
        icons: [{
          src: '/favicon.ico',
          sizes: '192x192',
          type: 'image/png'
        }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
