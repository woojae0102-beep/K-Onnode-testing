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

        // Mirror vercel.json rewrites for consolidated routers (Hobby ≤12 functions).
        const CONSOLIDATED = [
          { prefix: '/api/audition/', entry: '/api/audition' },
          { prefix: '/api/monthly/', entry: '/api/monthly' },
          { prefix: '/api/coaching/', entry: '/api/coaching' },
          { prefix: '/api/tv/', entry: '/api/tv' },
          { prefix: '/api/group/', entry: '/api/group' },
          { prefix: '/api/knowledge/', entry: '/api/knowledge' },
          { prefix: '/api/auth/', entry: '/api/auth' },
          { prefix: '/api/spotify/', entry: '/api/spotify' },
          { prefix: '/api/cron/', entry: '/api/cron' },
        ];
        const [rawPath, rawQuery = ''] = req.url.split('?');
        const urlPath = rawPath.replace(/\/+$/, '') || '/';
        for (const { prefix, entry } of CONSOLIDATED) {
          const base = prefix.slice(0, -1);
          if (urlPath === base || urlPath.startsWith(prefix)) {
            const sub = urlPath === base ? '' : urlPath.slice(prefix.length);
            const qs = new URLSearchParams(rawQuery);
            if (sub) qs.set('path', sub);
            req.url = `${entry}?${qs.toString()}`;
            break;
          }
        }

        const resolvedPath = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
        const rel = resolvedPath.slice(1);
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
          const libHandlers = path.resolve(process.cwd(), 'lib', 'api-handlers');
          const libApi = path.resolve(process.cwd(), 'lib', 'api-lib');
          for (const k of Object.keys(__require.cache)) {
            if (k.startsWith(apiDir) || k.startsWith(libHandlers) || k.startsWith(libApi)) delete __require.cache[k];
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
          if (typeof res.send !== 'function') {
            res.send = (body) => {
              if (Buffer.isBuffer(body) || typeof body === 'string') {
                if (!res.headersSent) res.setHeader('Content-Type', res.getHeader('Content-Type') || 'application/octet-stream');
                res.end(body);
              } else {
                res.end(JSON.stringify(body));
              }
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
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico,woff,woff2}'],
        globIgnores: ['**/mediapipe/wasm/**'],
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  };
});
