// red-flags — макет сайта мошенников: найти «красные флажки» кликом, потом выбрать действие.
// data: {
//   intro, url, title, timer: 299 (секунд), fields: ['Логин от игры', …], download, reviews: [['Игрок1', 'Супер!!!'], …],
//   flags: { url: 'why', timer: 'why', … } — какие элементы являются флажками (id → объяснение),
//   plain: 'Это обычная часть сайта.', need: 5,
//   q, options: [{ text, ok, why }], after?, next?
// }
// id элементов: url, title, timer, f0..fN (поля формы), download, reviews, logo, menu, footer.
import { h, rich } from '../util.js';
import { feedback, optionList } from './kit.js';

export default function redFlags(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const side = h('div', { class: 'w-col' });
  const counter = h('div', { class: 'vc-count' });
  const found = new Set();
  const mainIds = Object.keys(d.flags).filter((k) => !d.bonus?.includes(k));
  const upd = () => { counter.textContent = `Флажки: ${[...found].filter((k) => mainIds.includes(k)).length} из ${d.need}` + (d.bonus?.length ? ' (+ бонусный)' : ''); };
  upd();
  let timeLeft = d.timer ?? 299;
  const timerEl = h('span', {});
  const tick = setInterval(() => {
    timeLeft = timeLeft > 0 ? timeLeft - 1 : 299;
    timerEl.textContent = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
  }, 1000);
  timerEl.textContent = '04:59';
  let done = false;

  const z = (id, node) => {
    node.classList.add('rf-z');
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      if (done && !d.bonus?.includes(id)) return;
      if (d.flags[id]) {
        if (found.has(id)) return;
        found.add(id);
        node.classList.add('rf-flag');
        node.append(h('span', { class: 'rf-pin' }, '⚑'));
        api.sound.play('good');
        fb.ok((d.bonus?.includes(id) ? '**Бонус!** ' : '') + d.flags[id]);
        upd();
        if (!done && mainIds.every((k) => found.has(k))) choose();
      } else {
        if (!node.classList.contains('rf-plain')) api.mistake(); // промах (иначе «без ошибок» — перебором)
        node.classList.add('rf-plain');
        api.sound.play('click');
        fb.info(d.plain);
      }
    });
    return node;
  };

  const site = h('div', { class: 'rf-site' },
    z('url', h('div', { class: 'rf-url' }, h('span', { class: 'rf-lock' }, 'ⓘ'), d.url)),
    h('div', { class: 'rf-page' },
      h('div', { class: 'rf-nav' }, z('logo', h('span', { class: 'rf-logo' }, '★ GAME-PRO')), z('menu', h('span', { class: 'rf-menu' }, 'Главная · О нас · Помощь'))),
      z('title', h('div', { class: 'rf-title' }, d.title)),
      z('timer', h('div', { class: 'rf-timer' }, 'Акция закончится через ', timerEl)),
      h('div', { class: 'rf-form' }, d.fields.map((f, i) => z('f' + i, h('label', {}, f, h('span', { class: 'rf-input' }))))),
      z('download', h('div', { class: 'rf-dl' }, d.download)),
      z('reviews', h('div', { class: 'rf-reviews' }, d.reviews.map(([n, t]) => h('div', {}, h('b', {}, n + ': '), t)))),
      z('footer', h('div', { class: 'rf-foot' }, '© 2026 Game-Pro. Все права защищены')),
    ),
  );

  const choose = () => {
    done = true;
    const { el: list } = optionList(d.options, api, () => {
      if (d.after) side.append(h('div', { class: 'w-after', html: rich(d.after) }));
      next.classList.remove('hidden');
      side.append(h('div', { class: 'w-actions' }, next));
    });
    side.append(h('h3', { class: 'w-q', html: rich(d.q) }), list);
  };

  fb.info('Кликай по подозрительным местам на сайте.');
  side.append(d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), counter, fb.el);
  el.append(h('div', { class: 'w-two wide-left' }, h('div', { class: 'mock-tablet' }, site), side));
  return () => clearInterval(tick);
}
