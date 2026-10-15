import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const AUDIO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../demo/audio');
const AUDIO_TYPES: Record<string, string> = { '.mp3': 'audio/mpeg', '.json': 'application/json', '.wav': 'audio/wav' };

/** Serves ../../demo/audio at /audio in dev and copies it into dist/audio on build. */
function demoAudio(): Plugin {
  let outDir = 'dist';
  return {
    name: 'topiapause-demo-audio',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/audio', (req, res, next) => {
        const file = join(AUDIO_DIR, decodeURIComponent((req.url ?? '/').split('?')[0]!));
        if (!file.startsWith(AUDIO_DIR) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', AUDIO_TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      if (existsSync(AUDIO_DIR)) {
        cpSync(AUDIO_DIR, join(outDir, 'audio'), { recursive: true, filter: (src) => !src.endsWith('.md') });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), demoAudio()],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
