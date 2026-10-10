// Запуск dev-сервера и сборки для конкретной игры из games/<slug>.
//   node tools/run.mjs dev <slug>
//   node tools/run.mjs build <slug>
//   node tools/run.mjs build --all
//   node tools/run.mjs list
import { readdirSync, existsSync, renameSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, build } from 'vite';

const [, , cmd, arg] = process.argv;
const root = process.cwd();
const gamesDir = join(root, 'games');

const listGames = () =>
  readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .filter((d) => existsSync(join(gamesDir, d.name, 'scenario.js')))
    .map((d) => d.name);

function need(slug) {
  if (!slug) {
    console.error('Укажите игру: npm run build -- <slug>. Есть: ' + listGames().join(', '));
    process.exit(1);
  }
  if (!listGames().includes(slug)) {
    console.error(`Нет игры «${slug}». Есть: ${listGames().join(', ')}`);
    process.exit(1);
  }
}

async function buildOne(slug) {
  process.env.VITE_GAME = slug;
  await build({ configFile: join(root, 'vite.config.js'), logLevel: 'warn' });
  const tmp = join(root, 'dist', '.tmp-' + slug);
  mkdirSync(join(root, 'dist'), { recursive: true });
  const out = join(root, 'dist', slug + '.html');
  renameSync(join(tmp, 'index.html'), out);
  rmSync(tmp, { recursive: true, force: true });
  // Готовая к запуску копия — в корне проекта (TEMA_N.html): её можно открыть двойным кликом сразу после клонирования.
  copyFileSync(out, join(root, slug + '.html'));
  console.log('Собрано: dist/' + slug + '.html и ' + slug + '.html в корне проекта');
}

if (cmd === 'list') {
  console.log(listGames().join('\n'));
} else if (cmd === 'dev') {
  const slug = arg || 'TEMA_1';
  need(slug);
  process.env.VITE_GAME = slug;
  const server = await createServer({ configFile: join(root, 'vite.config.js') });
  await server.listen();
  server.printUrls();
} else if (cmd === 'build') {
  const slugs = arg === '--all' ? listGames() : [arg];
  for (const s of slugs) { need(s); await buildOne(s); }
} else {
  console.log('Команды: dev <slug> | build <slug> | build --all | list');
}
