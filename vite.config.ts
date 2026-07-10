import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Splits the eager bundle by how often each piece actually
        // changes/updates, not just by size — react/react-dom/react-
        // router-dom are the least volatile (Vercel's CDN + the
        // browser's own cache keep serving this chunk unchanged across
        // most deploys), the Supabase client is the next most stable,
        // and lucide-react (a large icon set, imported piecemeal across
        // nearly every component) gets its own chunk since it's already
        // shown up as this app's single biggest non-app dependency in
        // build output. App code — the part that changes on every
        // deploy — stays out of all three, so a routine deploy only
        // invalidates the one chunk that actually changed instead of
        // the whole bundle.
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/react-router-dom|\/react\/|\/react-dom\//.test(id)) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
          }
        },
      },
    },
  },
})
