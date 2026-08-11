import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(1)
const publicBase = repositoryName ? `/${repositoryName}/` : './'

export default defineConfig({
  base: publicBase,
  plugins:[
    react(),
    VitePWA({
      registerType:'autoUpdate',
      includeAssets:['icon.svg','pwa-icon-192.png','pwa-icon-512.png','pwa-maskable-512.png','apple-touch-icon.png'],
      manifest:{
        id:'./',
        name:'Esfuerzo Operativo',
        short_name:'Esfuerzo',
        description:'Consulta ejecutiva de impulso, USD y Merch por región, distrito y tienda.',
        lang:'es-MX',
        dir:'ltr',
        categories:['business','productivity'],
        theme_color:'#006241',
        background_color:'#f7f3eb',
        display:'standalone',
        display_override:['standalone','minimal-ui'],
        start_url:'./',
        scope:'./',
        icons:[
          { src:'pwa-icon-192.png', sizes:'192x192', type:'image/png', purpose:'any' },
          { src:'pwa-icon-512.png', sizes:'512x512', type:'image/png', purpose:'any' },
          { src:'pwa-maskable-512.png', sizes:'512x512', type:'image/png', purpose:'maskable' },
          { src:'icon.svg', sizes:'any', type:'image/svg+xml', purpose:'any' }
        ],
      },
      workbox:{
        mode:'development',
        cleanupOutdatedCaches:true,
        globPatterns:['**/*.{js,css,html,json}'],
        manifestTransforms:[async entries => ({
          manifest:entries.filter(entry => !entry.url.endsWith('data/dashboard.json')),
          warnings:[],
        })],
        runtimeCaching:[
          {
            urlPattern:({ url }: { url: URL }) => url.pathname.endsWith('/data/dashboard.json'),
            handler:'NetworkFirst',
            options:{ cacheName:'esfuerzo-data-v4', networkTimeoutSeconds:3, expiration:{ maxEntries:2, maxAgeSeconds:86400 } },
          },
          {
            urlPattern:({ request }: { request: Request }) => request.destination === 'image',
            handler:'CacheFirst',
            options:{ cacheName:'esfuerzo-images-v3', expiration:{ maxEntries:16, maxAgeSeconds:2592000 } },
          },
        ],
      },
    }),
  ],
  build:{ target:'es2022', cssCodeSplit:true, sourcemap:false, emptyOutDir:true },
})
