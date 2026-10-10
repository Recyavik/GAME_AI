// sort — разложить карточки по корзинам.
// data: {
//   intro, title?, bins: [{ id, title }], cards: [{ text, img?, bin, why?, wrong? }],
//   check: true   — неверную карточку положить нельзя (она возвращается, «Подумай: wrong», ошибка засчитывается);
//   check: false  — разминка «как ты думаешь»: кладётся куда угодно, без оценки; результат — в ctx.state[save];
//   save?: 'before', next?
// }
// Управление: перетащить карточку в корзину ИЛИ тап по карточке, затем тап по корзине (удобно на доске).
import { h, rich, shuffle } from '../util.js';
import { feedback, dragCard, cancelDrag } from './kit.js';

export default function sort(el, d, api) {
  const check = d.check !== false;
  const fb = feedback();
  fb.info(check ? 'Выбери карточку и положи её в нужную корзину.' : 'Тут нет правильных и неправильных ответов — разложи, как думаешь сейчас.');
  const next = h('button', { class: 'btn primary hidden', onclick: () => finish() }, d.next || 'Дальше');
  const pool = h('div', { class: 'sort-pool' });
  let selected = null;
  let left = d.cards.length;
  const result = {};

  const bins = d.bins.map((b) => {
    const list = h('div', { class: 'bin-list' });
    const bel = h('div', { class: 'bin', 'data-bin': b.id }, h('div', { class: 'bin-title', html: rich(b.title) }), list);
    bel.onclick = (e) => { if (selected && !e.target.closest('.scard')) place(selected, b.id); };
    return { ...b, el: bel, list };
  });

  const cards = shuffle(d.cards).map((c) => {
    const cel = h('div', { class: 'scard' + (c.img ? ' has-img' : '') },
      c.img && h('img', { src: c.img, alt: '', draggable: 'false' }),
      h('span', { html: rich(c.text) }),
    );
    const card = { ...c, el: cel, placed: false };
    cel.addEventListener('pointerdown', (e) => startDrag(e, card));
    return card;
  });
  pool.append(...cards.map((c) => c.el));

  function select(card) {
    if (selected) selected.el.classList.remove('sel');
    selected = card;
    card?.el.classList.add('sel');
    api.sound.play('click');
  }

  function place(card, binId) {
    const bin = bins.find((b) => b.id === binId);
    if (!check) {
      // Разминка: можно перекладывать, пока не нажали «Готово».
      if (!card.placed) left--;
      card.placed = true;
      result[card.text] = binId;
      card.el.classList.remove('sel');
      bin.list.append(card.el);
      selected = null;
      api.sound.play('pop');
      if (left === 0) { fb.info('Все карточки разложены. Можно переложить или нажать «Готово».'); next.classList.remove('hidden'); }
      return;
    }
    if (card.placed) return;
    if (card.bin === binId) {
      card.placed = true;
      card.el.classList.remove('sel');
      card.el.classList.add('placed');
      bin.list.append(card.el);
      selected = null;
      left--;
      api.sound.play('good');
      fb.ok(card.why || 'Верно!');
      if (left === 0) {
        fb.ok((card.why ? card.why + '\n' : '') + '**Всё разложено правильно!**');
        next.classList.remove('hidden');
      }
    } else {
      api.sound.play('bad');
      api.mistake();
      card.el.classList.remove('shake');
      void card.el.offsetWidth;
      card.el.classList.add('shake');
      select(null);
      if (card.wrong) fb.warn(card.wrong);
      else { fb.el.className = 'fb bad'; fb.el.textContent = 'Не сюда. Попробуй другую корзину.'; }
    }
  }

  function finish() {
    if (!check && d.save && api.ctx.state) api.ctx.state[d.save] = { ...result };
    api.done();
  }

  // Перетаскивание (мышь, палец, перо); короткое нажатие — выбор карточки.
  function startDrag(e, card) {
    if (card.placed && check) return;
    dragCard(e, card.el, Object.fromEntries(bins.map((b) => [b.id, b.el])), { drop: (id) => place(card, id), tap: () => select(selected === card ? null : card) });
  }

  el.append(
    h('div', { class: 'w-sort' },
      d.title && h('h3', { class: 'w-q', html: rich(d.title) }),
      d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }),
      pool,
      h('div', { class: 'bins', style: { gridTemplateColumns: `repeat(${bins.length}, 1fr)` } }, bins.map((b) => b.el)),
      fb.el,
      h('div', { class: 'w-actions' }, next),
    ),
  );
  return cancelDrag;
}
