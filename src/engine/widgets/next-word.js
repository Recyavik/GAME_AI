// next-word — «Угадай следующее слово»: ученик выбирает слово, потом видит, как выбрала бы нейросеть.
// data: { intro, rounds: [{ text: 'У лукоморья дуб …', words: [['зелёный', 81], …] }], conclusion, next? }
// Правильных ответов нет — это игра в угадайку, как у самой нейросети.
import { h, rich, shuffle } from '../util.js';
import { feedback } from './kit.js';

export default function nextWord(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const box = h('div', { class: 'nw-box' });
  let r = 0;

  const round = () => {
    const R = d.rounds[r];
    const sentence = h('div', { class: 'nw-sentence', html: rich(R.text).replace('…', '<span class="nw-blank">?</span>') });
    const btns = h('div', { class: 'opts row' });
    const bars = h('div', { class: 'nw-bars hidden' });
    for (const [w] of shuffle(R.words)) {
      const b = h('button', { class: 'chip big' }, w);
      b.onclick = () => {
        btns.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        b.classList.add('on');
        sentence.querySelector('.nw-blank').textContent = w;
        const top = Math.max(...R.words.map((x) => x[1]));
        bars.replaceChildren(h('div', { class: 'nw-cap' }, 'Как выбрала бы нейросеть:'), ...R.words.map(([word, p]) =>
          h('div', { class: 'nw-bar' + (word === w ? ' mine' : '') },
            h('span', { class: 'nw-w' }, (p === top ? '★ ' : '') + word),
            h('span', { class: 'nw-track' }, h('i', { style: { width: p + '%' } })),
            h('span', { class: 'nw-p' }, p + ' %'),
          )));
        bars.classList.remove('hidden');
        api.sound.play(p(R, w) === top ? 'good' : 'pop');
        r++;
        if (r < d.rounds.length) {
          box.append(h('div', { class: 'w-actions' }, h('button', { class: 'btn primary', onclick: round }, 'Следующая фраза')));
        } else {
          fb.ok(d.conclusion);
          next.classList.remove('hidden');
        }
      };
      btns.append(b);
    }
    box.replaceChildren(h('div', { class: 'nw-round' }, `Фраза ${r + 1} из ${d.rounds.length}`), sentence, btns, bars);
  };
  const p = (R, w) => R.words.find((x) => x[0] === w)[1];

  el.append(h('div', { class: 'w-nextword' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), box, fb.el, h('div', { class: 'w-actions' }, next)));
  round();
}
