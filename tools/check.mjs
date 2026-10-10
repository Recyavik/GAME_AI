// Проверка данных игры без браузера: картинки и звуки на месте, вопросы по правилам проекта,
// ссылки между этапами, персонажами, точками мира и виджетами не битые.
//   node tools/check.mjs TEMA_1        (или npm run check -- TEMA_1; без имени — все игры)
// Ошибки (✗) ломают игру или правила — код выхода 1. Предупреждения (!) — стоит посмотреть глазами.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const games = process.argv[2]
  ? [process.argv[2]]
  : readdirSync(join(root, 'games'), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);

// Мир строится в three.js; для проверки подставляем «пустышку», которая только запоминает точки, NPC и значки.
function fakeWorld() {
  const ids = { point: new Set(), spot: new Set(), npc: new Set() };
  const any = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, construct: () => any });
  const W = new Proxy({ actions: {}, life: null, center: { set() {} } }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in ids) return (id) => { ids[k].add(String(id).split('@')[0]); return any; };
      return any;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { W, F: any, ids };
}

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, entries: [] } });
let errors = 0, warns = 0;
const err = (m) => { errors++; console.log('  ✗ ' + m); };
const warn = (m) => { warns++; console.log('  ! ' + m); };

try {
  const { WIDGETS } = await server.ssrLoadModule('/src/engine/widgets/index.js');
  for (const slug of games) {
    console.log(`\n${slug}`);
    process.env.VITE_GAME = slug;
    const sc = (await server.ssrLoadModule(`/games/${slug}/scenario.js`)).default;
    const { W, F, ids } = fakeWorld();
    if (existsSync(join(root, 'games', slug, 'world.js'))) (await server.ssrLoadModule(`/games/${slug}/world.js`)).default(W, F);

    // 1. Картинки и звуки: пустые значения в полях-ссылках.
    const MEDIA = /^(img|icon|portrait|logo|finaleImg|clip|clips|callbackClip|open|closed|iris|star|window|palms|f|m)$/;
    const walk = (o, path) => {
      if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`));
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (MEDIA.test(k) && v === undefined) err(`${path}.${k}: картинка/звук не найдены (опечатка в имени?)`);
        walk(v, `${path}.${k}`);
      }
    };
    walk(sc, 'scenario');

    // 2. Вопросы: 4 варианта, один верный, у неверных — объяснение, верный не выделяется длиной.
    const checkOpts = (opts, where, okIndex) => {
      if (!Array.isArray(opts) || !opts.length) return;
      const objs = typeof opts[0] === 'object';
      const texts = opts.map((o) => (typeof o === 'string' ? o : o.text || o.label || '')).map((t) => t.replace(/\{([^{}|]*)\|[^{}]*\}|\{а\}/g, '$1'));
      const okIdx = objs ? opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0) : okIndex != null ? [okIndex] : [];
      if (opts.length !== 4) err(`${where}: вариантов ${opts.length}, нужно 4`);
      if (okIdx.length !== 1) (okIdx.length ? warn : err)(`${where}: верных вариантов ${okIdx.length}`);
      if (objs) opts.forEach((o, i) => { if (!o.ok && !o.why) err(`${where}: у неверного «${texts[i]}» нет объяснения why`); });
      if (okIdx.length === 1 && texts.every(Boolean)) {
        const len = texts.map((t) => t.length);
        const others = len.filter((_, i) => i !== okIdx[0]);
        const avg = others.reduce((a, b) => a + b, 0) / others.length;
        if (len[okIdx[0]] > Math.max(...others) && len[okIdx[0]] > avg * 1.15) warn(`${where}: верный вариант длиннее остальных (${len[okIdx[0]]} против ${others.join('/')}) — «${texts[okIdx[0]]}»`);
      }
    };
    const scan = (o, path) => {
      if (Array.isArray(o)) return o.forEach((x, i) => scan(x, `${path}[${i}]`));
      if (!o || typeof o !== 'object') return;
      // Вопрос — это варианты-строки с номером верного (ok) или варианты-объекты, где у кого-то есть ok.
      const isQuestion = Array.isArray(o.options) && o.options.length &&
        (typeof o.options[0] === 'string' ? typeof o.ok === 'number' : o.options.some((x) => x && typeof x === 'object' && 'ok' in x));
      if (isQuestion) {
        checkOpts(o.options, `${path}${o.q ? ` «${String(o.q).slice(0, 40)}»` : ''}`, o.ok);
      }
      for (const [k, v] of Object.entries(o)) if (k !== 'options') scan(v, `${path}.${k}`);
    };
    scan(sc.stages, 'stages');
    scan(sc.rumors, 'rumors');
    (sc.quiz || []).forEach((q, i) => checkOpts(q.options, `quiz[${i}] «${q.q.slice(0, 40)}»`, q.ok));

    // 3. Связи: этапы, цели, персонажи, виджеты, карточки, щиты, достижения, листовки.
    const stageIds = new Set(sc.stages.map((s, i) => s.id || 's' + (i + 1)));
    const who = new Set(['me', 'owl', ...Object.keys(sc.cast || {})]);
    const cards = new Set((sc.cards || []).map((c) => c.id));
    const shields = new Set((sc.shields || []).map((c) => c.id));
    const ach = new Set((sc.achievements || []).map((c) => c.id));
    sc.stages.forEach((s, i) => {
      const at = `этап ${s.id || i + 1}`;
      for (const r of s.requires || []) if (!stageIds.has(r)) err(`${at}: requires «${r}» — нет такого этапа`);
      if (s.goal && ids.point.size && !ids.point.has(s.goal)) err(`${at}: goal «${s.goal}» — нет такой точки в world.js`);
      const flowWalk = (o) => {
        if (Array.isArray(o)) return o.forEach(flowWalk);
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o.say)) for (const line of o.say) {
          const id = String(Array.isArray(line) ? line[0] : line.who || '').split(':')[0];
          if (id && !who.has(id)) err(`${at}: реплику говорит «${id}» — нет в cast`);
        }
        if (typeof o.widget === 'string' && !WIDGETS[o.widget]) err(`${at}: виджет «${o.widget}» не зарегистрирован`);
        if (o.card && typeof o.card === 'string' && !cards.has(o.card)) err(`${at}: карточка «${o.card}» не описана в cards`);
        if (o.shield && typeof o.shield === 'string' && !shields.has(o.shield)) err(`${at}: щит «${o.shield}» не описан в shields`);
        if (o.achieve && !ach.has(o.achieve)) err(`${at}: достижение «${o.achieve}» не описано в achievements`);
        Object.values(o).forEach(flowWalk);
      };
      flowWalk(s.flow);
    });
    if (ids.spot.size) for (const r of sc.rumors || []) if (!ids.spot.has(r.id)) err(`листовка «${r.id}»: нет значка W.spot в world.js`);
    for (const n of ids.npc) if (!sc.cast?.[n]) err(`world.js: NPC «${n}» не описан в cast`);

    console.log(`  этапов ${sc.stages.length}, вопросов теста ${sc.quiz?.length || 0}, точек мира ${ids.point.size}, значков ${ids.spot.size}`);
  }
} finally {
  await server.close();
}
console.log(`\nИтог: ошибок ${errors}, предупреждений ${warns}`);
process.exit(errors ? 1 : 0);
