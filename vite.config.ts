import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { basePath } from './basePath.ts'

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
  /\/((newsreader|ibm-plex-sans)-latin-(400|500|600)-(normal|italic)|(noto-sans-bengali|tiro-bangla)-(bengali|latin)-(400|500|600)-normal)-[\w-]+\.woff2$/
const SHELL_FONT_CSS = /\/font-(newsreader|ibm-plex-sans|noto-sans-bengali|tiro-bangla)--[^/]*\.css$/
// Keep in step with the pattern written out in runtimeCaching.urlPattern below.
const IS_FONT = /\/(font-[^/]*\.css|[^/]*\.woff2)$/

// Where the site lives: /arthik/ on GitHub Pages (the default), / on a host that serves it at
// the root, such as Render (basePath.ts).
const BASE = basePath()

/**
 * The page may load and talk to nothing but its own origin, and the browser enforces it on
 * every host (GitHub Pages cannot send headers, so it is a meta tag). Styles allow inline
 * because React writes style attributes; scripts never do. Fonts are self-hosted, and the
 * service worker's script and registerSW.js are same-origin files.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/**
 * Puts the policy into the built page. Only the build: the dev server injects inline scripts
 * of its own (React Fast Refresh), which the policy would block.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'arthik:content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    woff2Only(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      // The default registration is the external registerSW.js, which the policy allows: no
      // inline script. ('script' would say the same but drops clientsClaim, so the first visit
      // would not be controlled.)
      manifest: {
        name: 'Arthik',
        short_name: 'Arthik',
        description: 'See how your money habits add up. Your data stays in your browser.',
        start_url: BASE,
        scope: BASE,
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
            // Written out here, not as IS_FONT: Workbox copies this function into sw.js on its
            // own, so a constant from this file would not exist there.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && /\/(font-[^/]*\.css|[^/]*\.woff2)$/.test(url.pathname),
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
    // Fonts are always files, never data: URLs written into the stylesheet, which the policy's
    // font-src 'self' would block.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
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
    // The whole-app tests (a page, a language change, an upload) take 1 to 3 seconds alone and
    // several times that when the machine is busy with other test files. 5 seconds is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
