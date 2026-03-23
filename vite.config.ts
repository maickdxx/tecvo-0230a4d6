import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Tecvo - Gestão para Técnicos",
        short_name: "Tecvo",
        description: "Sistema de gestão para técnicos de refrigeração",
        theme_color: "#1e6bb8",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Tecvo Gestão",
            short_name: "Gestão",
            description: "Painel de gestão da empresa",
            url: "/dashboard",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Tecvo Chat",
            short_name: "Chat",
            description: "Atendimento rápido de clientes",
            url: "/whatsapp",
            icons: [{ src: "/icon-chat-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // Only precache the app shell — JS, CSS, HTML. NO images, NO fonts.
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html}"],
        // Exclude heavy files from precache
        globIgnores: [
          "**/assets/ad-*",
          "**/assets/screenshot-*",
          "**/assets/tecvo-instagram-*",
        ],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2MB max per file
        importScripts: ["/sw-push.js"],
        // Clean old caches on activate
        cleanupOutdatedCaches: true,
        // Skip waiting to activate new SW immediately
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          // Edge functions — never cache
          {
            urlPattern: /\/functions\/v1\/.*/i,
            handler: "NetworkOnly" as const,
          },
          // Supabase storage/uploads — never cache
          {
            urlPattern: /\/storage\/v1\/.*/i,
            handler: "NetworkOnly" as const,
          },
          // Supabase REST API — network-first, tiny cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 30, // 30 min
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              matchOptions: {
                ignoreSearch: false,
              },
            },
          },
          // Supabase auth — network only
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly" as const,
          },
          // App icons only — cache-first, strict limit
          {
            urlPattern: /\.(ico|png)$/i,
            handler: "CacheFirst" as const,
            options: {
              cacheName: "app-icons",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Fonts — cache-first, strict limit
          {
            urlPattern: /\.(woff2?|ttf|otf)$/i,
            handler: "CacheFirst" as const,
            options: {
              cacheName: "fonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          radix: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-tooltip",
          ],
          markdown: ["react-markdown"],
        },
      },
    },
  },
}));
