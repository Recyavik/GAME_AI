// Сервер сайта игры: стартовая страница, сама игра и счётчик «В игру сыграли».
// Без внешних библиотек — только Node.js 20+.
//
//   node web/server.js            → http://localhost:8080
//   PORT=3000 DATA_DIR=./data node web/server.js
//
// Маршруты:
//   /                    стартовая страница (web/public)
//   /game/TEMA_1.html    игра (готовый файл из корня проекта)
//   /img/<группа>/<файл> картинки игры (games/TEMA_1/assets) — портреты героев и т. п.
//   POST /api/visit      +1 к счётчику, ответ { count }
//   GET  /api/visits     текущее значение { count }
//   GET  /api/health     для проверки контейнера
//
// Сохранение игры у каждого игрока своё — в его браузере (localStorage), сервер его не хранит.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.ROOT || path.join(HERE, '..'));
const PUBLIC = path.join(HERE, 'public');
const ASSETS = path.join(ROOT, 'games', 'TEMA_1', 'assets');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(HERE, 'data'));
const PORT = Number(process.env.PORT || 8080);
const COUNTER_FILE = path.join(DATA_DIR, 'visits.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
};
const COMPRESS = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);

// ---------- счётчик ----------
let visits = 0;
let saveTimer = null;
fs.mkdirSync(DATA_DIR, { recursive: true });
// В контейнере сервер стартует от root только для того, чтобы отдать папку данных пользователю node
// (хостинг может подключить том, принадлежащий root), и сразу понижает права.
if (process.getuid?.() === 0 && process.env.RUN_AS_UID) {
  const uid = Number(process.env.RUN_AS_UID);
  try { fs.chownSync(DATA_DIR, uid, uid); for (const f of fs.readdirSync(DATA_DIR)) fs.chownSync(path.join(DATA_DIR, f), uid, uid); }
  catch (e) { console.error('Не удалось выдать права на папку данных:', e.message); }
  process.setgid(uid); process.setuid(uid);
}
try { visits = Number(JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).count) || 0; } catch { visits = 0; }
// Проверка записи при старте: если папка недоступна, счётчик будет обнуляться — пишем об этом в лог сразу.
let writable = true;
try { fs.accessSync(DATA_DIR, fs.constants.W_OK); } catch { writable = false; }

// Запись не чаще раза в секунду, через временный файл (не повредится при сбое).
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const tmp = COUNTER_FILE + '.tmp';
    try {
      await fsp.writeFile(tmp, JSON.stringify({ count: visits, updated: new Date().toISOString() }));
      await fsp.rename(tmp, COUNTER_FILE);
    } catch (e) { console.error('Счётчик не сохранён:', e.message); }
  }, 1000);
}

// ---------- статика ----------
// Сжатые версии кешируются в памяти (игра — 6 МБ, в gzip меньше, а сжимать её на каждый запрос дорого).
const cache = new Map(); // путь → { mtime, raw, gz, br }

async function load(file) {
  const st = await fsp.stat(file);
  if (!st.isFile()) return null;
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit;
  const raw = await fsp.readFile(file);
  const ext = path.extname(file).toLowerCase();
  const entry = { mtime: st.mtimeMs, raw, etag: `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"` };
  if (COMPRESS.has(ext)) {
    entry.br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    entry.gz = zlib.gzipSync(raw, { level: 9 });
  }
  cache.set(file, entry);
  return entry;
}

// Путь запроса → файл на диске (с защитой от выхода за пределы папки).
function resolveFile(urlPath) {
  const inside = (base, rel) => {
    const f = path.normalize(path.join(base, rel));
    return f.startsWith(base + path.sep) || f === base ? f : null;
  };
  if (urlPath === '/game/TEMA_1.html' || urlPath === '/game/' || urlPath === '/game') return path.join(ROOT, 'TEMA_1.html');
  if (urlPath.startsWith('/img/')) return inside(ASSETS, urlPath.slice(5));
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  return inside(PUBLIC, rel);
}

async function sendFile(req, res, file) {
  let entry;
  try { entry = file && (await load(file)); } catch { entry = null; }
  if (!entry) return send(res, 404, 'Страница не найдена', 'text/plain; charset=utf-8');
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    ETag: entry.etag,
    // Страницы, стили и скрипты браузер сверяет с сервером при каждом открытии (ETag) — после обновления
    // сайта все сразу видят новую версию. Картинки и шрифты меняются редко — кешируем на неделю.
    'Cache-Control': ['.html', '.css', '.js', '.json'].includes(ext) ? 'no-cache' : 'public, max-age=604800',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304, headers); return res.end(); }
  const accept = String(req.headers['accept-encoding'] || '');
  let body = entry.raw;
  if (entry.br && /\bbr\b/.test(accept)) { body = entry.br; headers['Content-Encoding'] = 'br'; }
  else if (entry.gz && /\bgzip\b/.test(accept)) { body = entry.gz; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

// ---------- сервер ----------
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, { error: 'bad url' }); }
  const p = decodeURIComponent(url.pathname);

  if (p === '/api/visit' && req.method === 'POST') {
    visits += 1;
    saveSoon();
    return send(res, 200, { count: visits });
  }
  if (p === '/api/visits' && req.method === 'GET') return send(res, 200, { count: visits });
  if (p === '/api/health') return send(res, 200, { ok: true, count: visits, saved: writable });
  if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' });
  return sendFile(req, res, resolveFile(p));
});

server.listen(PORT, () => {
  console.log(`Сайт игры: http://localhost:${PORT}  (счётчик: ${visits}, данные: ${DATA_DIR})`);
  if (!writable) console.error(`ВНИМАНИЕ: нет права записи в ${DATA_DIR} — счётчик не сохранится после перезапуска.`);
});

// Аккуратная остановка (docker stop): дописать счётчик на диск.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: visits, updated: new Date().toISOString() })); } catch { /* нет доступа к диску */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
