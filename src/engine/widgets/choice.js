// choice — вопрос с вариантами (перемешиваются).
// data: { q, text?, img?, who?: { name, img } (кто спрашивает), options: [{ text, ok, why, partial }], after?, next? }
import { h, rich } from '../util.js';
import { optionList, nextButton } from './kit.js';

export default function choice(el, d, api) {
  const next = nextButton(api, d.next);
  const after = h('div', { class: 'w-after hidden', html: d.after ? rich(d.after) : '' });
  const { el: list } = optionList(d.options, api, () => {
    next.classList.remove('hidden');
    if (d.after) after.classList.remove('hidden');
    next.focus();
  });
  el.append(
    h('div', { class: 'w-choice' + (d.img ? ' with-img' : '') },
      d.img && h('img', { class: 'w-img', src: d.img, alt: '' }),
      h('div', { class: 'w-col' },
        d.who && h('div', { class: 'w-who' }, d.who.img && h('img', { src: d.who.img, alt: '' }), h('b', {}, d.who.name)),
        d.text && h('p', { class: 'w-intro', html: rich(d.text) }),
        h('h3', { class: 'w-q', html: rich(d.q) }),
        list,
        after,
        h('div', { class: 'w-actions' }, next),
      ),
    ),
  );
}
