// fact-check — «Проверь справку ИИ»: найти неверные предложения кликом, затем вопрос «как проверить».
// data: {
//   intro, author: { name, img }, title,
//   lines: [{ text, wrong?: true, fix }], found: 'реплика после поиска',
//   q, options: [{ text, ok, why }], after?, next?
// }
import { h, rich } from '../util.js';
import { feedback, optionList } from './kit.js';

export default function factCheck(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const need = d.lines.filter((l) => l.wrong).length;
  let found = 0;
  const counter = h('div', { class: 'vc-count' }, `Ошибки найдены: 0 из ${need}`);
  const tail = h('div');
  const doc = h('div', { class: 'fc-doc' },
    h('div', { class: 'fc-head' }, d.author.img && h('img', { src: d.author.img, alt: '' }), h('b', {}, d.title)),
    ...d.lines.map((l, i) => {
      const s = h('button', { class: 'fc-line' }, `${i + 1}. ${l.text}`);
      s.onclick = () => {
        if (s.disabled || found >= need) return;
        if (l.wrong) {
          s.disabled = true;
          s.classList.add('bad-found');
          s.append(h('span', { class: 'fc-fix', html: ' → ' + rich(l.fix) }));
          found++;
          counter.textContent = `Ошибки найдены: ${found} из ${need}`;
          api.sound.play('good');
          fb.ok('Ошибка! ' + l.fix);
          if (found === need) ask();
        } else {
          s.classList.add('checked');
          api.sound.play('click');
          fb.info('Это предложение верное.');
        }
      };
      return s;
    }),
  );
  const ask = () => {
    fb.ok(d.found);
    const { el: list } = optionList(d.options, api, () => {
      if (d.after) tail.append(h('div', { class: 'w-after', html: rich(d.after) }));
      next.classList.remove('hidden');
    });
    tail.append(h('h3', { class: 'w-q', html: rich(d.q) }), list);
  };
  fb.info('Кликни по предложениям, в которых ошибка.');
  el.append(h('div', { class: 'w-factcheck' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), doc, counter, fb.el, tail, h('div', { class: 'w-actions' }, next)));
}
