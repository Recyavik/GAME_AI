// Сборка одной игры в один самостоятельный HTML (работает без интернета).
// Имя игры приходит из tools/run.mjs через переменную окружения VITE_GAME.
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

const game = process.env.VITE_GAME || 'TEMA_1';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  resolve: { alias: { '@game': resolve(import.meta.dirname, 'games', game) } },
  build: {
    outDir: 'dist/.tmp-' + game,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // шрифты, картинки и всё прочее — внутрь файла
    cssCodeSplit: false,
    chunkSizeWarningLimit: 6000,
  },
  server: { open: true },
});
