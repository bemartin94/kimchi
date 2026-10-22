import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseHost = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).host : undefined
  // A RegExp literal is serialized as-is into the generated service worker.
  // A matcher *function* referencing `supabaseHost` would NOT work here --
  // generateSW stringifies the function into the standalone sw.js file, which
  // has no access to this config module's closure, so the variable would be
  // undefined there and the route would silently never match.
  const supabaseDataPattern = supabaseHost
    ? new RegExp(`^https://${supabaseHost.replace(/\./g, '\\.')}/rest/v1/(recipes|categories)`)
    : /^$/

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        workbox: {
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Recipes/categories: try the network first (fresh data while
              // online), fall back to the last-seen copy when offline. Give up
              // on the network quickly so offline doesn't mean a long stall.
              urlPattern: supabaseDataPattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'recetario-data',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Recipe thumbnails (YouTube or whatever host the source site used)
              // — rarely change, so serve from cache once fetched.
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'recetario-images',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'Recetario',
          short_name: 'Recetario',
          description: 'Save recipes from YouTube videos, organized by category.',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#ea580c',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          // Lets Android's share sheet (e.g. from the YouTube app) list this
          // installed PWA directly. YouTube shares a link via EXTRA_TEXT, which
          // Chrome maps to either `text` or `url` depending on Android version,
          // so the /share-target route checks both.
          share_target: {
            action: '/share-target',
            method: 'GET',
            params: {
              title: 'title',
              text: 'text',
              url: 'url',
            },
          },
        },
      }),
    ],
  }
})
