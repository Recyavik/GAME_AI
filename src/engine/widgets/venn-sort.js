// venn-sort — «Робот» и «ИИ»: четыре равных столбика —
// только робот / и то и другое / только ИИ / ни то, ни другое. Экспонаты лежат на верстаке.
// Карточку ПЕРЕТАСКИВАЮТ в зону (мышь, палец, перо); запасной способ — нажать карточку, потом зону.
// Раскладываешь всё, потом «Проверить»: ошибки возвращаются с пояснением (ошибка засчитывается).
// data: { intro, left: 'Робот', right: 'ИИ', bench?: 'подпись верстака', cards: [{ text, img, zone: 'left'|'both'|'right'|'none', wrong }], success, next? }
import { h, rich, shuffle } from '../util.js';
import { feedback, dragCard, cancelDrag } from './kit.js';

export default function vennSort(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const check = h('button', { class: 'btn primary', disabled: true }, 'Проверить');
  const pool = h('div', { class: 'sort-pool bench-pool' });
  let selected = null;
  const zones = {};
  const mk = (id, title, cls = '') => {
    const list = h('div', { class: 'bin-list' });
    const z = h('div', { class: 'vz vz-' + id + ' ' + cls, 'data-zone': id }, h('div', { class: 'vz-title' }, title), list);
    z.onclick = (e) => { if (selected && !e.target.closest('.scard')) put(selected, id); };
    zones[id] = { el: z, list };
    return z;
  };
  // Четыре столбика одинакового размера.
  const venn = h('div', { class: 'vcols' },
    mk('left', `Только ${d.left.toLowerCase()}`),
    mk('both', `И ${d.left.toLowerCase()}, и ${d.right}`),
    mk('right', `Только ${d.right}`),
    mk('none', 'Ни то, ни другое'),
  );

  const cards = shuffle(d.cards).map((c) => {
    const ce = h('div', { class: 'scard has-img' }, c.img && h('img', { src: c.img, alt: '', draggable: 'false' }), h('span', { html: rich(c.text) }));
    const card = { ...c, el: ce, at: null, locked: false };
    ce.addEventListener('pointerdown', (e) => startDrag(e, card));
    return card;
  });
  pool.append(...cards.map((c) => c.el));

  const select = (card) => {
    if (selected) selected.el.classList.remove('sel');
    selected = card?.locked ? null : card;
    selected?.el.classList.add('sel');
    if (card) api.sound.play('click');
  };

  const put = (card, id) => {
    if (card.locked) return;
    card.at = id;
    card.el.classList.remove('sel', 'bad');
    zones[id].list.append(card.el);
    selected = null;
    api.sound.play('pop');
    check.disabled = cards.some((c) => !c.at);
    if (!check.disabled) fb.info('Всё разложено — нажми «Проверить». Карточки ещё можно переложить.');
  };

  // Перетаскивание; короткое нажатие без движения — выбор карточки.
  const zoneEls = () => Object.fromEntries(Object.entries(zones).map(([id, z]) => [id, z.el]));
  function startDrag(e, card) {
    if (card.locked) return;
    dragCard(e, card.el, zoneEls(), { drop: (id) => put(card, id), tap: () => select(selected === card ? null : card) });
  }

  check.onclick = () => {
    select(null);
    const wrong = cards.filter((c) => c.at !== c.zone);
    cards.filter((c) => c.at === c.zone).forEach((c) => { c.locked = true; c.el.classList.add('placed'); });
    if (wrong.length) {
      api.mistake();
      api.sound.play('bad');
      wrong.forEach((c) => { c.at = null; c.el.classList.add('bad'); pool.append(c.el); });
      check.disabled = true;
      fb.warn(wrong.map((c) => `«${c.text}»: ${c.wrong || 'подумай, есть ли у него тело и учится ли он.'}`).join('\n'));
    } else {
      api.sound.play('star');
      check.classList.add('hidden');
      fb.ok(d.success);
      next.classList.remove('hidden');
    }
  };

  fb.info('Перетащи каждую карточку в нужную зону. Когда разложишь всё — «Проверить».');
  el.append(h('div', { class: 'w-venn' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), h('div', { class: 'bench' }, h('div', { class: 'bench-label' }, d.bench || 'Верстак с экспонатами'), pool), venn, fb.el, h('div', { class: 'w-actions' }, check, next)));
  return cancelDrag;
}
