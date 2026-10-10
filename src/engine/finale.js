// Финал: штамп, звание, счётчики, выводы, памятка из щитов, достижения,
// «Блокнот», «Было — стало», «Тест», «Пройти ещё раз».
import { h, rich, shuffle } from './util.js';
import { sound } from './sound.js';
import { confetti, modal, onEsc } from './modal.js';
import { runStation } from './stations.js';
import { saveMemoPng } from './widgets/rules-builder.js';

// Картинка финала: своя у героя (hero.finaleImg), иначе общая (finale.img).
export function showFinale(sc, progress, hero, ctx) {
  sound.play('fanfare');
  confetti();
  const p = progress;
  const f = sc.finale;
  const art = hero?.finaleImg || f.img;
  const memoLines = sc.shields.map((s) => sc.memo?.lines?.[s.id] || s.rule);
  // Расшифровка очков: из чего сложилось.
  let shieldPts = 0;
  for (const v of p.shields.values()) shieldPts += v;
  const scoreLine = `Очки: карточки ${p.cards.size * 2} из ${p.cardsTotal * 2} · щиты ${shieldPts} из ${p.shieldsTotal * 2} (с ошибками — 1 очко за щит) · листовки ${p.rumorsFirst * 2} из ${p.rumorsTotal * 2} (только с первой попытки)` +
    (sc.eyes?.bonus ? ` · зарядка для глаз ${p.bonus.get('eyes') || 0} из ${sc.eyes.bonus}` : '');
  const wrap = h('div', { class: 'overlay finale-wrap' },
    h('div', { class: 'finale' },
      h('div', { class: 'fin-scroll' },
      art && h('div', { class: 'fin-art' }, h('img', { src: art, alt: '' })),
      h('div', { class: 'fin-main' },
        h('div', { class: 'stamp' }, f.stamp),
        h('div', { class: 'fin-rank' }, h('span', {}, 'Твоё звание'), h('b', {}, p.rank())),
        h('div', { class: 'fin-stats' },
          stat('Карточки', `${p.cards.size}/${p.cardsTotal}`),
          stat('Щиты', `${p.shields.size}/${p.shieldsTotal}`),
          stat('Слухи', `${p.rumorsDone}/${p.rumorsTotal}`),
          stat('Очки', `${p.score}/${p.maxScore}`),
        ),
        h('div', { class: 'fin-score-line' }, scoreLine),
        h('div', { class: 'takeaways' },
          f.takeaways.map(([t, d], i) => h('div', { class: 'take' }, h('div', { class: 'take-n' }, i + 1), h('b', { html: rich(t) }), h('p', { html: rich(d) }))),
        ),
        h('div', { class: 'fin-memo' },
          h('div', { class: 'fin-h' }, 'Памятка безопасного общения с ИИ'),
          h('div', { class: 'fin-shields' }, sc.shields.map((s) => h('div', { class: 'fin-shield' + (p.shields.has(s.id) ? '' : ' off'), title: s.rule }, s.icon && h('img', { src: s.icon, alt: '' }), h('span', {}, s.title)))),
          h('button', { class: 'btn small', onclick: () => saveMemoPng(sc.memo?.title || 'Памятка', memoLines) }, 'Сохранить памятку (PNG)'),
        ),
        sc.achievements?.length && h('div', { class: 'fin-ach' },
          h('div', { class: 'fin-h' }, `Достижения · ${p.ach.size} из ${sc.achievements.length}`),
          h('div', { class: 'medals' }, sc.achievements.map((a) => {
            const got = p.ach.has(a.id);
            return h('div', { class: 'medal-cell' + (got ? '' : ' off'), title: got ? a.title : a.hint },
              h('span', { class: 'medal', style: { '--mc': got ? a.color : '#c9c9d4' } }, a.icon),
              h('span', {}, got ? a.title : a.hint));
          })),
        ),
        f.rule && h('div', { class: 'fin-rule', html: rich(f.rule) }),
      ),
      ),
      // Панель кнопок всегда видна внизу карточки финала.
      h('div', { class: 'fin-bar' },
        h('button', { class: 'btn', onclick: () => p.notebook() }, 'Блокнот'),
        sc.warmup && p.before && h('button', { class: 'btn', onclick: () => { if (!document.querySelector('.overlay:not(.finale-wrap)')) beforeAfter(sc, p, ctx); } }, 'Было — стало'),
        sc.quiz?.length && h('button', { class: 'btn primary', onclick: () => { if (!document.querySelector('.overlay:not(.finale-wrap)')) runQuiz(sc.quiz); } }, 'Тест'),
        h('button', { class: 'btn', onclick: () => location.reload() }, '↻ Пройти ещё раз'),
        h('button', { class: 'btn finish', onclick: () => finish() }, 'Завершить игру'),
      ),
    ),
  );
  // Экран окончания: благодарность и итог, игра остановлена.
  function finish() {
    sound.play('click');
    wrap.remove();
    const end = h('div', { class: 'overlay end-wrap' },
      h('div', { class: 'modal end-card' },
        sc.meta.logo && h('img', { class: 'title-logo', src: sc.meta.logo, alt: '' }),
        h('h2', {}, 'Игра завершена'),
        h('p', { class: 'center' }, 'Спасибо за игру! Главное правило помнишь?'),
        h('div', { class: 'fin-rule', html: rich(f.rule || '') }),
        h('div', { class: 'fin-stats center-row' }, stat('Звание', p.rank()), stat('Очки', `${p.score}/${p.maxScore}`)),
        h('div', { class: 'modal-btns center-row' },
          h('button', { class: 'btn', onclick: () => { end.remove(); document.getElementById('ui').append(wrap); } }, '← К итогам'),
          h('button', { class: 'btn', onclick: () => location.reload() }, '↻ Пройти ещё раз'),
          h('button', { class: 'btn primary', onclick: closeGame }, '✕ Закрыть игру'),
        ),
      ),
    );
    document.getElementById('ui').append(end);
  }
  document.getElementById('ui').append(wrap);
}

// Закрыть игру: выйти из полного экрана и закрыть вкладку. Вкладку, открытую двойным кликом по файлу,
// браузер закрыть разрешает; если не разрешил — выключаем игру и подсказываем, как закрыть вкладку.
export async function closeGame() {
  sound.play('click');
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* не в полном экране */ }
  if (sound.on) sound.toggle(); // тишина
  window.close();
  setTimeout(() => {
    document.body.replaceChildren(h('div', { class: 'overlay closed-screen' }, // .overlay — сцена встаёт на паузу
      h('h2', {}, 'Игра закрыта'),
      h('p', {}, 'Закройте вкладку браузера: крестик на вкладке или клавиши Ctrl + W.'),
    ));
  }, 300);
}

// «Было — стало»: та же сортировка, но теперь с проверкой, и сравнение с разминкой.
async function beforeAfter(sc, p, ctx) {
  const w = sc.warmup;
  const res = await runStation({ title: 'Было — стало', kind: 'extra', steps: [{ widget: 'sort', data: { ...w, check: true, intro: 'Разложи карточки ещё раз — теперь с проверкой.' } }] }, ctx);
  if (res?.result !== 'done') return; // вышли, не доделав
  const rows = w.cards.map((c) => {
    const was = p.before[c.text];
    return { c, wasRight: was === c.bin, was };
  });
  const right = rows.filter((r) => r.wasRight).length;
  const changed = rows.filter((r) => !r.wasRight);
  const binTitle = (id) => w.bins.find((b) => b.id === id)?.title || '—';
  await modal({
    title: 'Было — стало',
    body: h('div', {},
      h('p', { html: rich(`Утром ты {угадал|угадала} **${right} из ${w.cards.length}**. Сейчас — **${w.cards.length} из ${w.cards.length}**.`) }),
      changed.length
        ? h('div', {}, h('p', { html: rich('Ты {изменил|изменила} мнение:') }),
          h('ul', { class: 'ba-list' }, changed.map((r) => h('li', {}, h('b', {}, r.c.text), ` — утром: «${binTitle(r.was)}», теперь: «${binTitle(r.c.bin)}»`))))
        : h('p', { html: rich('Ты с самого утра всё {знал|знала} — отлично!') }),
    ),
  });
}

const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));

// Тест: вопросы по одному, после ответа — пояснение. В конце — результат.
function runQuiz(quiz) {
  let i = 0;
  let right = 0;
  // Перемешиваем варианты, запоминая верный (заново при каждой попытке).
  const mix = () => quiz.map((q) => {
    const order = shuffle(q.options.map((_, k) => k));
    return { ...q, options: order.map((k) => q.options[k]), ok: order.indexOf(q.ok) };
  });
  let qs = mix();
  const box = h('div', { class: 'modal quiz' });
  const wrap = h('div', { class: 'overlay' }, box);
  document.getElementById('ui').append(wrap);
  onEsc(wrap, () => close());
  sound.play('open');

  const close = () => { sound.play('click'); wrap.remove(); };

  function show() {
    const q = qs[i];
    let answered = false;
    const fb = h('div', { class: 'fb' });
    const next = h('button', { class: 'btn primary hidden' }, i + 1 < qs.length ? 'Следующий вопрос' : 'Результат');
    next.onclick = () => { i++; if (i < qs.length) show(); else result(); };
    box.replaceChildren(
      h('div', { class: 'quiz-top' }, h('span', {}, `Вопрос ${i + 1} из ${qs.length}`), h('button', { class: 'st-close', onclick: close, title: 'Закрыть' }, '✕')),
      h('div', { class: 'sc-bar' }, h('i', { style: { width: `${(i / qs.length) * 100}%` } })),
      h('h3', { class: 'w-q', html: rich(q.q) }),
      h('div', { class: 'opts' },
        q.options.map((t, k) => {
          const b = h('button', { class: 'opt', html: `<span class="opt-l">${'АБВГД'[k]}</span>${rich(t)}` });
          b.onclick = () => {
            if (answered) return;
            answered = true;
            const ok = k === q.ok;
            if (ok) right++;
            b.classList.add(ok ? 'ok' : 'bad');
            if (!ok) box.querySelectorAll('.opt')[q.ok].classList.add('ok');
            fb.className = 'fb ' + (ok ? 'ok' : 'bad');
            fb.innerHTML = (ok ? '<b>Верно!</b> ' : '<b>Не совсем.</b> ') + rich(q.why || '');
            sound.play(ok ? 'good' : 'bad');
            next.classList.remove('hidden');
          };
          return b;
        }),
      ),
      fb,
      h('div', { class: 'modal-btns' }, next),
    );
  }

  function result() {
    const pct = right / qs.length;
    sound.play(pct >= 0.7 ? 'fanfare' : 'good');
    if (pct >= 0.7) confetti(2500);
    box.replaceChildren(
      h('h2', {}, 'Результат теста'),
      h('div', { class: 'quiz-score' }, `${right} из ${qs.length}`),
      h('p', { class: 'center', html: rich(pct === 1 ? 'Безупречно!' : pct >= 0.7 ? 'Отлично! Ты хорошо {разобрался|разобралась} в теме.' : 'Неплохо! Загляни в доску находок и попробуй ещё раз.') }),
      h('div', { class: 'modal-btns' },
        h('button', { class: 'btn', onclick: () => { i = 0; right = 0; qs = mix(); show(); } }, 'Пройти тест заново'),
        h('button', { class: 'btn primary', onclick: close }, 'Закрыть'),
      ),
    );
  }
  show();
}
