import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Dev-time API middleware: routes /api/* requests in `npm run dev` to the
// CommonJS handlers under ./api/, the same files Vercel uses in production.
// This lets the local dev server hit the live YouTube API instead of mocks.
const __require = createRequire(import.meta.url);
function devApiPlugin() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const urlPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';
        const rel = urlPath.slice(1); // remove leading "/"
        const candidates = [
          path.resolve(process.cwd(), `${rel}.js`),
          path.resolve(process.cwd(), rel, 'index.js'),
        ];
        const handlerPath = candidates.find((p) => existsSync(p));
        if (!handlerPath) return next();

        if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
          await new Promise((resolve) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf8');
              try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
              resolve();
            });
          });
        }

        try {
          // Invalidate require cache for all files under ./api so changes
          // to nested helper modules (e.g. _lib/trending.js) are picked up.
          const apiDir = path.resolve(process.cwd(), 'api');
          for (const k of Object.keys(__require.cache)) {
            if (k.startsWith(apiDir)) delete __require.cache[k];
          }
          const mod = __require(handlerPath);
          const fn = typeof mod === 'function' ? mod : (mod.default || mod.handler);
          if (typeof fn !== 'function') {
            res.statusCode = 500;
            res.end(`Handler at ${handlerPath} is not a function`);
            return;
          }
          if (typeof res.status !== 'function') {
            res.status = (code) => { res.statusCode = code; return res; };
          }
          if (typeof res.json !== 'function') {
            res.json = (obj) => {
              if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(obj));
              return res;
            };
          }
          await fn(req, res);
        } catch (err) {
          console.error(`[dev-api] error in ${handlerPath}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dev API error', message: String(err?.message || err) }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Inject ALL .env values (not just VITE_-prefixed) into process.env so
  // server-only keys like YOUTUBE_API_KEY are available to the dev API plugin.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return {
  plugins: [
    devApiPlugin(),
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon.ico',
        'icons/apple-touch-icon-180x180.png',
        'icons/source.svg',
        'idol-choreo-skeleton.json',
      ],
      manifest: {
        id: '/',
        name: 'K-Onnode',
        short_name: 'K-Onnode',
        description: 'AI 기반 K-POP 댄스 코칭 · 실시간 자세 분석 플랫폼',
        lang: 'ko',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        orientation: 'any',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        categories: ['fitness', 'lifestyle', 'entertainment'],
        icons: [
          {
            src: '/icons/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // MediaPipe WASM/Task 파일이 커서 10MB까지 허용
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,wasm,json,png,svg,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts 스타일시트
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // Google Fonts 본체
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // YouTube 썸네일
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'youtube-thumbnails',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Spotify/기타 이미지 CDN
            urlPattern: /^https:\/\/i\.scdn\.co\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'spotify-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Discover API 는 네트워크 우선, 실패 시 캐시
            urlPattern: /\/api\/discover.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-discover',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Firestore / Firebase 실시간 통신은 절대 캐싱 X
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Gemini API 는 항상 네트워크
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    https: true,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  };
});
