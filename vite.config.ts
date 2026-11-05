import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const PAPER = '#F4EFE4'

/**
 * Fontsource's stylesheets list every font twice, woff2 and woff. Every browser that can run
 * the app reads woff2, so the woff files are left out of the build: half the font bytes.
 */
function woff2Only(): Plugin {
  return {
    name: 'arthik:woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/@fontsource/') || !id.endsWith('.css')) return null
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '')
    },
  }
}

/**
 * The fonts the app shell needs, cached ahead of time so the first screen draws offline:
 * Latin text (Newsreader and IBM Plex Sans), and the Bengali set, which has the ৳ sign every
 * language uses for taka and the wordmark's "আর্থিক". Every other script's fonts are fetched
 * when a language first needs them and cached then (runtimeCaching below).
 */
const SHELL_FONT_FILE =
  /\/((newsreader|ibm-plex-sans)-latin-(400|500|600)-(normal|italic)|(noto-sans-bengali|tiro-bangla)-bengali-(400|500|600)-normal)-[\w-]+\.woff2$/
const SHELL_FONT_CSS = /\/font-(newsreader|ibm-plex-sans|noto-sans-bengali|tiro-bangla)--[^/]*\.css$/
const IS_FONT = /\/(font-[^/]*\.css|[^/]*\.woff2)$/

export default defineConfig({
  base: '/arthik/',
  plugins: [
    react(),
    woff2Only(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Arthik',
        short_name: 'Arthik',
        description: 'See how your money habits add up. Your data stays in your browser.',
        start_url: '/arthik/',
        scope: '/arthik/',
        display: 'standalone',
        background_color: PAPER,
        theme_color: PAPER,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // The app shell: the page, its scripts (including each language's messages and each
        // sample person's data), stylesheets and the template file.
        globPatterns: ['**/*.{html,js,css,svg,png,csv,webmanifest,woff2}'],
        // ...and of the fonts, only the shell's.
        manifestTransforms: [
          (entries) => ({
            manifest: entries.filter(
              ({ url }) =>
                !IS_FONT.test(`/${url}`) ||
                SHELL_FONT_FILE.test(`/${url}`) ||
                SHELL_FONT_CSS.test(`/${url}`),
            ),
            warnings: [],
          }),
        ],
        // Only same-origin static files are ever cached. A file the visitor opens is read in
        // the browser and never requested, so nothing they make passes through the cache.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && IS_FONT.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'arthik-fonts',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Each font stylesheet keeps the name of its family, so the service worker can tell
        // the shell's fonts from the others.
        assetFileNames(asset) {
          const family = /@fontsource[/\\]([^/\\]+)[/\\]/.exec(
            (asset.originalFileNames ?? []).join(' '),
          )?.[1]
          return family && asset.names.some((name) => name.endsWith('.css'))
            ? `assets/font-${family}--[name]-[hash][extname]`
            : 'assets/[name]-[hash][extname]'
        },
        // The libraries change rarely, so they are cached apart from the app's own code.
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[/\\](react|react-dom|react-router|react-intl|@formatjs|scheduler|papaparse)[/\\]/,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
