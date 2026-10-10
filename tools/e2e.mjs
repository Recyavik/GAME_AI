// Сквозной тест в настоящем браузере: титул → все этапы (автопилот G + пробел + решение станций
// перебором вариантов) → финал → «Было — стало» → тест. Падает, если игра застряла, в консоли есть
// ошибки, есть внешние запросы или игра открыла новую вкладку.
//   node tools/e2e.mjs [dist/TEMA_1.html] [--hero 2] [--shots папка] [--size 1366x768] [--resume N]
// --resume N — после N выполненных станций перезагрузить страницу и нажать «Продолжить»:
// прогресс, документы и станции должны вернуться.
// Нужен установленный Chrome, Edge или Яндекс.Браузер (путь можно задать в переменной CHROME).
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const file = resolve(argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) || 'dist/TEMA_1.html');
const hero = +opt('hero', 1);
const resumeAt = +opt('resume', 0);
const shots = opt('shots', null);
const [W, H] = opt('size', '1366x768').split('x').map(Number);
if (shots) mkdirSync(shots, { recursive: true });
if (!existsSync(file)) { console.error('Нет файла ' + file + ' — сначала npm run build -- <игра>'); process.exit(1); }

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Yandex/YandexBrowser/Application/browser.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) { console.error('Не найден Chrome/Edge — укажите путь в переменной CHROME'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath, headless: 'new', defaultViewport: { width: W, height: H },
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const problems = [];
browser.on('targetcreated', (tg) => { if (tg.type() === 'page') problems.push('игра открыла новую вкладку: ' + tg.url()); });
page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => problems.push('ошибка JS: ' + e.message));
page.on('request', (r) => { if (/^https?:/.test(r.url())) problems.push('внешний запрос: ' + r.url()); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $click = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (e && !e.disabled) { e.click(); return true; } return false; }, sel);
const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.closest('.hidden'); }, sel);
const btnText = (re) => page.evaluate((src) => {
  const r = new RegExp(src);
  const b = [...document.querySelectorAll('.overlay button, .title-screen button')].reverse().find((x) => !x.disabled && !x.closest('.hidden') && x.offsetParent && r.test(x.textContent));
  if (b) { b.click(); return b.textContent; }
  return null;
}, re.source);
const snap = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const NEXT = /^(Взять щит|Дальше|Готово|Войти|Выступить|Получить пропуск|Получить билет|Итог|Следующий совет|Следующий слух|Следующая фраза|Дальше: разрешения)/;
const fail = async (why) => { console.log('✗ ' + why); await snap('FAIL'); await browser.close(); process.exit(1); };

await page.goto('file:///' + file.replace(/\\/g, '/'));
await sleep(2500);
await snap('00_title');
if (hero === 2) await page.evaluate(() => document.querySelectorAll('.hero-btn')[1]?.click());
if (!(await btnText(/Начать/))) await fail('нет кнопки «Начать» на титуле');
await sleep(1200);

const stations = [];
let rejected = 0, lastStage = '', lastG = 0, stuckKey = '', stuckN = 0, stageAt = Date.now(), diagAt = 0;
let escChecked = false, resumed = false;
const hudState = () => page.evaluate(() => ({
  counters: [...document.querySelectorAll('.counters .counter b')].map((b) => b.textContent).join(' '),
  docs: [...document.querySelectorAll('.hud-doc b')].map((b) => b.textContent).join(', '),
  stage: document.querySelector('.sc-top')?.textContent,
}));
const calm = async () => !(await page.$('.overlay')) && !(await vis('.dialog'));
const t0 = Date.now();
const LIMIT = 15 * 60 * 1000;
while (!(await page.$('.finale'))) {
  if (Date.now() - t0 > LIMIT) await fail('не дошли до финала за 15 минут, этап: ' + lastStage);
  const stage = await page.evaluate(() => document.querySelector('.sc-top')?.textContent || '');
  if (stage !== lastStage) { lastStage = stage; stageAt = Date.now(); console.log(`  ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} с  ${stage}`); }
  // Esc закрывает окна: список станций (Q) и блокнот (B).
  if (!escChecked && /Выполнено 1 из/.test(stage) && (await calm())) {
    escChecked = true;
    for (const [k, name] of [['KeyQ', 'список станций'], ['KeyB', 'блокнот']]) {
      await page.keyboard.press(k); await sleep(500);
      if (!(await page.$('.overlay'))) { problems.push(`клавиша ${k} не открыла ${name}`); continue; }
      await page.keyboard.press('Escape'); await sleep(500);
      if (await page.$('.overlay')) { problems.push(`Esc не закрыл ${name}`); await btnText(/Закрыть|Понятно/); }
    }
    console.log('  Esc закрывает список станций и блокнот: проверено');
  }
  // «Продолжить» после перезагрузки.
  if (resumeAt && !resumed && new RegExp(`Выполнено ${resumeAt} из`).test(stage) && (await calm())) {
    resumed = true;
    await sleep(6000); // сохранение — раз в 5 с и после каждой станции
    const before = await hudState();
    await page.reload();
    await sleep(2500);
    const panel = await page.evaluate(() => document.querySelector('.title-continue')?.innerText.replace(/\s+/g, ' '));
    if (!panel) await fail('после перезагрузки на титуле нет «Продолжить»');
    console.log('  перезагрузка, на титуле:', panel);
    await page.evaluate(() => document.querySelector('.title-continue button').click());
    await sleep(2500);
    const after = await hudState();
    console.log('  до:   ', JSON.stringify(before));
    console.log('  после:', JSON.stringify(after));
    if (before.counters !== after.counters || before.docs !== after.docs || before.stage !== after.stage) problems.push('после «Продолжить» прогресс не совпал');
    continue;
  }
  // Этап долго не меняется — пишем, что на экране (помогает найти, где игра «залипает»).
  if (Date.now() - stageAt > 90000 && Date.now() - diagAt > 60000) {
    diagAt = Date.now();
    console.log('  ? долго на этапе:', JSON.stringify(await page.evaluate(() => ({
      overlay: document.querySelector('.overlay .modal h2, .overlay .st-title')?.textContent || null,
      dialog: !document.querySelector('.dialog')?.classList.contains('hidden') ? document.querySelector('.dlg-text')?.textContent?.slice(0, 60) : null,
      goal: document.querySelector('.goal-marker:not(.hidden) .gm-text')?.textContent || null,
      task: document.querySelector('.sc-task')?.textContent,
    }))));
    await snap('diag_' + Math.round((Date.now() - t0) / 1000));
  }
  if (await page.$('.station')) { await solve(); continue; }
  if (await page.$('.overlay')) { (await btnText(/Дальше|Понятно|Закрыть/)) || (await $click('.overlay .modal-btns .btn')); await sleep(300); continue; }
  if (await vis('.dialog')) { await page.keyboard.press('Space'); await sleep(200); continue; }
  const badge = await page.$('.spot-badge:not(.hidden):not(.done)');
  if (badge) {
    await badge.evaluate((b) => b.click());
    await sleep(400);
    for (let k = 0; k < 4 && !(await page.$('.rumor-modal .opt.ok')); k++) { await $click('.rumor-modal .opt:not(:disabled)'); await sleep(250); }
    if (!(await page.$('.rumor-modal .opt.ok'))) await fail('листовка: ни один из 4 вариантов не принят');
    await btnText(/Дальше|Закрыть/);
    await sleep(300);
    continue;
  }
  if ((await vis('.goal-marker')) && Date.now() - lastG > 2500) { await page.keyboard.press('KeyG'); lastG = Date.now(); await sleep(900); }
  await sleep(250);
}
console.log(`  финал за ${((Date.now() - t0) / 1000).toFixed(0)} с`);
await sleep(1500);
await snap('90_finale');
const stats = await page.evaluate(() => document.querySelector('.fin-stats')?.innerText.replace(/\n/g, ' '));
if (await btnText(/Было — стало/)) {
  await sleep(600);
  for (let i = 0; i < 80 && (await page.$('.station')); i++) await solve();
  await page.keyboard.press('Escape');
  await sleep(400);
}
if (!(await btnText(/^Тест/))) problems.push('в финале нет кнопки «Тест»');
await sleep(500);
let quizN = 0;
for (let i = 0; i < 12 && (await page.$('.quiz .opt')); i++) {
  quizN++;
  await $click('.quiz .opt');
  await sleep(200);
  await btnText(/Следующий вопрос|Результат/);
  await sleep(200);
}
await snap('92_quiz');
// Закрыть тест → «Завершить игру» → «Закрыть игру». У тестовой вкладки есть история, браузер её
// не закроет — должна появиться заставка «Игра закрыта».
await btnText(/^Закрыть$/);
await sleep(300);
if (!(await btnText(/Завершить игру/))) problems.push('в финале нет кнопки «Завершить игру»');
await sleep(500);
if (!(await btnText(/Закрыть игру/))) problems.push('на экране окончания нет кнопки «Закрыть игру»');
await sleep(800);
if (!page.isClosed() && !(await page.$('.closed-screen'))) problems.push('после «Закрыть игру» нет заставки «Игра закрыта»');
await snap('93_closed');
// После финала сохранение стёрто: при новом открытии «Продолжить» не предлагается.
if (!page.isClosed()) {
  await page.reload();
  await sleep(2500);
  if (await page.$('.title-continue')) problems.push('после финала на титуле всё ещё «Продолжить»');
}
await browser.close();

console.log(`  итог финала: ${stats}`);
console.log(`  окон станций: ${stations.length}, отклонено неверных ответов: ${rejected}, вопросов теста: ${quizN}`);
if (problems.length) { console.log('✗ Проблемы:\n  ' + [...new Set(problems)].join('\n  ')); process.exit(1); }
console.log('✓ Игра пройдена от титула до теста без ошибок');

// ---------- решатели станций ----------
async function solve() {
  const sig = await page.evaluate(() => (document.querySelector('.st-body')?.innerText || '').slice(0, 400));
  if (sig === stuckKey) { if (++stuckN > 60) await fail('станция не решается: ' + sig.split('\n').slice(0, 3).join(' / ')); } else { stuckKey = sig; stuckN = 0; }
  const title = await page.evaluate(() => document.querySelector('.st-title')?.textContent + ' ' + (document.querySelector('.st-step')?.textContent || ''));
  const kind = await page.evaluate(() => document.querySelector('.st-body > div')?.className || '');
  if (!stations.includes(title.trim())) { stations.push(title.trim()); await sleep(300); await snap('st_' + String(stations.length).padStart(2, '0')); }
  if (await page.$('.rule-card')) { await btnText(/Взять щит/); await sleep(500); return; }
  if ((await page.$('.perm')) && !(await vis('.st-body .w-two > .w-col .btn.primary:not(.hidden)'))) {
    await flipBadPerms();
    await btnText(/^Готово$/);
    await sleep(250);
    if (await page.$('.perm.bad')) rejected++;
    return;
  }
  if (await btnText(NEXT)) { await sleep(450); return; }
  if (kind.includes('w-sort')) {
    const n = (await page.$$('.bin')).length;
    for (let k = 0; k < n; k++) {
      const before = await page.evaluate(() => document.querySelectorAll('.sort-pool .scard').length);
      if (!before) break;
      await page.evaluate(() => document.querySelector('.sort-pool .scard').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      await page.evaluate(() => dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
      await sleep(80);
      await page.evaluate((k) => document.querySelectorAll('.bin')[k].click(), k);
      await sleep(150);
      if ((await page.evaluate(() => document.querySelectorAll('.sort-pool .scard').length)) < before) break;
      rejected++;
    }
    return;
  }
  if (kind.includes('w-two')) {
    const what = await page.evaluate(() => {
      const b = document.querySelector('.st-body');
      return ['fg-gate', 'fm-pic', 'ap-screen', 'be-cam', 'vc-speaker', 'call-screen', 'cc-pic', 'pb-canvas', 'ttt', 'rf-site', 'rb-pile', 'mp-chat-top'].find((c) => b.querySelector('.' + c)) || '';
    });
    if (what === 'fm-pic') {
      for (const [x, y] of [[152, 228], [248, 228], [200, 290], [164, 338], [236, 338]]) {
        const r = await page.evaluate(() => { const s = document.querySelector('.fm-pic svg'); s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
        await page.mouse.click(r[0] + (x / 400) * r[2], r[1] + (y / 480) * r[3]);
        await sleep(200);
      }
      await sleep(900);
      return;
    }
    if (what === 'ap-screen') {
      if (await page.$('.ap-photo')) {
        for (let k = 0; k < 4 && !(await page.$('.ap-photo.ok')); k++) { await $click('.ap-photo:not(:disabled)'); await sleep(200); }
        await btnText(/Дальше: разрешения/);
        await sleep(300);
        return;
      }
      for (let k = 0; k < 6; k++) {
        await btnText(/^Готово$/);
        await sleep(250);
        if (await vis('.st-body > .w-two > .w-col .btn.primary:not(.hidden)')) break;
        if (!(await page.$('.perm.bad'))) break;
        rejected++;
        await flipBadPerms();
      }
      return;
    }
    if (what === 'be-cam' && (await page.$('.st-body .opts'))) {
      // Героем 2 отказываемся от фото — проверяем путь «пропуск с кодом».
      await page.evaluate((no) => document.querySelectorAll('.st-body .opts .opt')[no ? 1 : 0].click(), hero === 2);
      await sleep(400);
      await btnText(/Сделать снимок/);
      await sleep(2000);
      return;
    }
    if (what === 'vc-speaker') {
      if (await page.$('.vd-phrase')) {
        for (const b of await page.$$('.w-actions.left .btn')) { await b.evaluate((x) => x.click()); await sleep(3500); }
        await $click('.st-body .opts .opt');
        await sleep(300);
        return;
      }
      await voicePhrases();
      return;
    }
    if (what === 'call-screen') {
      if (await $click('.call-btn.green')) { await sleep(500); return; }
      for (let w = 0; w < 60 && !(await page.$('.st-body .opt')); w++) await sleep(250);
      await tryOpts('.st-body');
      await sleep(1200);
      return;
    }
    if (what === 'pb-canvas') {
      for (const row of await page.$$('.combo-part')) await row.evaluate((r) => r.querySelector('.chip').click());
      await btnText(/Нарисовать/);
      await sleep(3800);
      return;
    }
    if (what === 'cc-pic') {
      if ((await page.$('.cc-part:not(.flag):not(.plain)')) && (await page.evaluate(() => !!document.querySelector('.msg.cc-clickable')))) {
        await page.evaluate(() => document.querySelectorAll('.cc-part:not(.flag):not(.plain)').forEach((p) => p.click()));
        await sleep(300);
        return;
      }
      if (await page.$('.st-body .opts')) { await tryOpts('.st-body'); return; }
      for (const [x, y] of [[0.1, 0.18], [0.62, 0.23], [0.8, 0.68], [0.93, 0.09]]) {
        const r = await page.evaluate(() => { const i = document.querySelector('.cc-pic img'); i.scrollIntoView({ block: 'center' }); const b = i.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
        await page.mouse.click(r[0] + x * r[2], r[1] + y * r[3]);
        await sleep(250);
      }
      return;
    }
    if (what === 'ttt') {
      if ((await page.$('.ttt-status')) && (await page.evaluate(() => /Ничья|выиграл/.test(document.querySelector('.ttt-status').textContent)))) {
        await page.evaluate(() => document.querySelectorAll('.st-body .opts.row .chip:not(:disabled)').forEach((c) => c.click()));
        await sleep(300);
        return;
      }
      await page.evaluate(() => [...document.querySelectorAll('.ttt-cell')].find((x) => !x.children.length)?.click());
      await sleep(900);
      return;
    }
    if (what === 'rf-site') {
      if (await page.$('.st-body .opts')) { await tryOpts('.st-body'); return; }
      await page.evaluate(() => document.querySelectorAll('.rf-z').forEach((z) => z.click()));
      await sleep(300);
      return;
    }
    if (what === 'fg-gate') {
      if (await $click('.fg-badge:not(.applied)')) { await sleep(2600); return; }
      if (await btnText(/Моргнуть/)) { await sleep(800); return; }
      if (await page.$('.fg-pad')) {
        await page.evaluate(() => document.querySelector('.fg-pad button').click());
        await btnText(/Прикрыть/);
        const code = await page.evaluate(() => document.querySelector('.fg-code').textContent.replace(/\D/g, ''));
        for (const ch of code) { await page.evaluate((ch) => [...document.querySelectorAll('.fg-pad button')].find((b) => b.textContent === ch).click(), ch); await sleep(120); }
        await sleep(700);
        return;
      }
      if (await page.$('.w-who')) { await tryOpts('.st-body'); return; }
      await sleep(400);
      return;
    }
    if (what === 'rb-pile') {
      await page.evaluate(() => document.querySelectorAll('.rb-item:not(.used)').forEach((b) => b.click()));
      await sleep(1500);
      return;
    }
    if (what === 'mp-chat-top') {
      if (await page.$('.st-body .chat-choices .opt')) { await $click('.chat-choices .opt:not(:disabled)'); await sleep(500); if (await page.$('.chat-choices .opt.bad')) rejected++; return; }
      if (await page.$('.chat-log.cc-clickable')) { await page.evaluate(() => document.querySelectorAll('.chat-log .msg-text, .chat-log .msg-time.click').forEach((m) => m.click())); await sleep(300); return; }
      if (await page.$('.st-body .opts')) { await tryOpts('.st-body'); return; }
      await sleep(500);
      return;
    }
    if (await page.$('.st-body .opts')) { await tryOpts('.st-body'); return; }
    await sleep(300);
    return;
  }
  if (kind.includes('w-voice')) { await voicePhrases(); return; }
  if (kind.includes('w-threshold')) {
    await page.evaluate(() => { const s = document.querySelector('.th-slider'); s.value = 70; s.dispatchEvent(new Event('input')); s.value = 92; s.dispatchEvent(new Event('input')); });
    await sleep(300);
    return;
  }
  if (kind.includes('w-nextword')) {
    if (await btnText(/Следующая фраза/)) { await sleep(300); return; }
    await $click('.nw-box .chip:not(:disabled)');
    await sleep(400);
    return;
  }
  if (kind.includes('w-factcheck')) {
    if (await page.$('.st-body .opts')) { await tryOpts('.st-body'); return; }
    await page.evaluate(() => document.querySelectorAll('.fc-line:not(:disabled)').forEach((l) => l.click()));
    await sleep(400);
    return;
  }
  if (kind.includes('w-venn')) {
    for (const z of ['left', 'both', 'right', 'none']) {
      if (!(await page.evaluate(() => document.querySelectorAll('.sort-pool .scard').length))) break;
      await page.evaluate((z) => document.querySelectorAll('.sort-pool .scard').forEach((c) => {
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        document.querySelector('.vz-' + z).click();
      }), z);
      await sleep(150);
      await btnText(/Проверить/);
      await sleep(300);
    }
    return;
  }
  if (kind.includes('w-advice')) {
    if (await btnText(/Следующий совет|^Итог/)) { await sleep(1800); return; }
    const before = (await page.$$('.al-btn.bad')).length;
    await $click('.al-btn:not(:disabled):not(.bad)');
    await sleep(300);
    if ((await page.$$('.al-btn.bad')).length > before) rejected++;
    return;
  }
  if (kind.includes('w-evidence')) {
    if (await btnText(/Следующий слух/)) { await sleep(300); return; }
    const n = (await page.$$('.pe-card')).length;
    for (let k = 0; k < n; k++) {
      await page.evaluate((k) => document.querySelectorAll('.pe-card')[k].click(), k);
      await btnText(/Предъявить/);
      await sleep(250);
      if (await page.evaluate(() => [...document.querySelectorAll('.pe-card')].every((c) => c.disabled))) break;
      rejected++;
    }
    return;
  }
  if (kind.includes('w-choice')) { await tryOpts('.st-body'); return; }
  await sleep(300);
}

async function tryOpts(scope) {
  if (await page.$(`${scope} .opt.ok`)) return false;
  const ok = await $click(`${scope} .opt:not(:disabled):not(.bad):not(.partial)`);
  if (ok) { await sleep(300); if (await page.$(`${scope} .opt.bad`)) rejected++; }
  return ok;
}

async function flipBadPerms() {
  await page.evaluate(() => document.querySelectorAll('.perm.bad').forEach((row) => {
    const bs = [...row.querySelectorAll('.seg button')];
    const i = bs.findIndex((b) => b.classList.contains('on'));
    bs[(i + 1) % bs.length].click();
  }));
  await sleep(150);
}

// «Поймай ослышку»: самый сильный шум, каждую фразу — и честное решение «верно / ослышалась».
async function voicePhrases() {
  await page.evaluate(() => document.querySelectorAll('.seg button')[2].click());
  const n = (await page.$$('.vc-phrases .chip')).length;
  for (let i = 0; i < n; i++) {
    if (await vis('.st-body .w-actions .btn.primary:not(.hidden)')) break;
    await page.evaluate((i) => document.querySelectorAll('.vc-phrases .chip')[i].click(), i);
    for (let w = 0; w < 50 && !(await vis('.vc-judge')); w++) await sleep(200);
    const wrong = await page.evaluate((i) => {
      const said = document.querySelectorAll('.vc-phrases .chip')[i].textContent.replace(/[«»]/g, '');
      const heard = document.querySelector('.vc-heard b').textContent.replace(/[«»]/g, '');
      return said !== heard;
    }, i);
    await page.evaluate((w) => document.querySelectorAll('.vc-judge .btn')[w ? 1 : 0].click(), wrong);
    await sleep(300);
  }
}
