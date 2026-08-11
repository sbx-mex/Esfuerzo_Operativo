import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const publicBase = repositoryName ? `/${repositoryName}/` : './'

export default defineConfig({
  base:publicBase,
  plugins:[
    react(),
    VitePWA({
      registerType:'autoUpdate',
      manifest:{
        name:'Esfuerzo Operativo',
        short_name:'Esfuerzo',
        description:'Seguimiento operativo de impulso, USD y Merch para Centro Norte.',
        theme_color:'#006241',
        background_color:'#f7f3eb',
        display:'standalone',
        start_url:'./',
        scope:'./',
        icons:[
          { src:'icon.svg', sizes:'any', type:'image/svg+xml', purpose:'any maskable' }
        ],
      },
      workbox:{
        mode:'development',
        cleanupOutdatedCaches:true,
        globPatterns:['**/*.{js,css,html,json}'],
        manifestTransforms:[async entries => ({
          manifest:entries.filter(entry => !entry.url.endsWith('.png')),
          warnings:[],
        })],
        runtimeCaching:[
          {
            urlPattern:/\/data\/dashboard\.json$/,
            handler:'NetworkFirst',
            options:{ cacheName:'esfuerzo-data-v1', networkTimeoutSeconds:4, expiration:{ maxEntries:2, maxAgeSeconds:86400 } },
          },
          {
            urlPattern:({ request }) => request.destination === 'image',
            handler:'CacheFirst',
            options:{ cacheName:'esfuerzo-images-v1', expiration:{ maxEntries:8, maxAgeSeconds:2592000 } },
          },
        ],
      },
    }),
  ],
  build:{ target:'es2022', cssCodeSplit:true, sourcemap:false, emptyOutDir:true },
})
