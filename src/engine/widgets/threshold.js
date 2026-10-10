// threshold — «Кого пустит турникет?»: ползунок строгости и посетители с процентом совпадения.
// data: {
//   intro, task, min, max, start,
//   visitors: [{ name, note, match, pass (должен ли пройти), face: {…faceSvg}, phone?: true }],
//   success, next?
// }
// Задача ученика — подобрать строгость, при которой турникет решает правильно про всех.
import { h, rich } from '../util.js';
import { feedback, svgEl } from './kit.js';
import { faceSvg } from './faces.js';

export default function threshold(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const val = h('b', { class: 'th-val' });
  const slider = h('input', { type: 'range', min: d.min ?? 50, max: d.max ?? 99, value: d.start ?? 70, class: 'th-slider' });
  let moves = 0;
  let solved = false;

  const cards = d.visitors.map((v) => {
    const face = svgEl(faceSvg(v.face || {}), 'th-face' + (v.phone ? ' on-phone' : ''));
    const status = h('div', { class: 'th-status' });
    const card = h('div', { class: 'th-card' }, face, h('b', {}, v.name), h('div', { class: 'th-note' }, v.note), h('div', { class: 'th-match' }, `Совпадение ${v.match} %`), status);
    return { v, card, status };
  });

  const upd = () => {
    const t = +slider.value;
    val.textContent = `${t} %`;
    let allRight = true;
    for (const c of cards) {
      const pass = c.v.match >= t;
      const right = pass === c.v.pass;
      if (!right) allRight = false;
      c.status.textContent = pass ? 'Пропустит ✓' : 'Не пропустит ✕';
      c.card.classList.toggle('pass', pass);
      c.card.classList.toggle('right', right);
      c.card.classList.toggle('wrong', !right);
    }
    if (allRight && !solved) {
      solved = true;
      fb.ok(d.success);
      api.sound.play('good');
      next.classList.remove('hidden');
    } else if (!solved) {
      fb.info(moves ? 'Красная рамка — турникет ошибся. Двигай строгость дальше.' : d.task);
    }
  };
  slider.addEventListener('input', () => { moves++; upd(); });
  upd();

  el.append(
    h('div', { class: 'w-threshold' },
      d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }),
      h('div', { class: 'th-row' }, cards.map((c) => c.card)),
      h('label', { class: 'th-ctrl' }, 'Строгость турникета: ', val, slider),
      fb.el,
      h('div', { class: 'w-actions' }, next),
    ),
  );
}
