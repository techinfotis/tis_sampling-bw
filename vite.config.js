import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' agar service worker baru menunggu konfirmasi user
      // Layout.jsx akan tampilkan banner dan kirim SKIP_WAITING saat user klik update
      registerType: 'prompt',
      // Aktifkan service worker di dev mode untuk testing
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['favicon.ico', 'shaka-logo.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TIS BW',
        short_name: 'TIS BW',
        description: 'Aplikasi timbang berat ayam Smart Farm Layer 4.0',
        theme_color: '#10b981',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache semua asset aplikasi
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Strategi cache
        runtimeCaching: [
          {
            // Cache Supabase API dengan NetworkFirst
            urlPattern: /^https:\/\/fotwmpmtkszyhhmiuevw\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 jam
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache font dan asset eksternal
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 tahun
              }
            }
          }
        ],
        // JANGAN skipWaiting di sini — biarkan Layout.jsx yang handle via SKIP_WAITING message
        // agar user bisa konfirmasi update lewat banner notifikasi
        clientsClaim: true
      }
    })
  ]
});
