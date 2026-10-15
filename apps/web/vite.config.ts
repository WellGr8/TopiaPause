import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// public/audio (pre-generated voice clips + manifest.json) is served at /audio and copied into dist as-is.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // `TOPIAPAUSE_API=http://127.0.0.1:8787 pnpm dev` forwards /api to a running `wrangler dev`.
    proxy: process.env.TOPIAPAUSE_API ? { '/api': { target: process.env.TOPIAPAUSE_API, changeOrigin: true } } : undefined,
  },
  preview: { host: '0.0.0.0', port: 4173 },
});
