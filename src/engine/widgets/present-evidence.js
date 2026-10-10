// present-evidence — «Спор с Гошей»: на каждый слух предъяви карточку правды из блокнота.
// data: {
//   intro, opponent: { name, img },
//   rounds: [{ claim, accept: ['alive', …], reply, wrong }],   // wrong — «Не убедил{а}!» + почему
//   turn: 'реплика-поворот после последнего раунда', meter: 'Зал верит правде', next?
// }
import { h, rich } from '../util.js';
import { feedback, avatar } from './kit.js';

export default function presentEvidence(el, d, api) {
  const progress = api.ctx.progress;
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const fill = h('i');
  const meter = h('div', { class: 'pe-meter' }, h('span', {}, d.meter), h('div', { class: 'nw-track' }, fill));
  const box = h('div', { class: 'pe-box' });
  let r = 0;
  let selected = null;

  const show = () => {
    const R = d.rounds[r];
    selected = null;
    const present = h('button', { class: 'btn primary', disabled: true }, 'Предъявить');
    const cards = h('div', { class: 'pe-cards' }, progress.sc.cards.map((c) => {
      const has = progress.cards.has(c.id);
      const b = h('button', { class: 'pe-card' + (has ? '' : ' hint') }, h('b', {}, c.tag), h('span', { html: rich(c.text) }), !has && h('em', {}, 'подсказка зала'));
      b.onclick = () => {
        cards.querySelectorAll('.pe-card').forEach((x) => x.classList.toggle('sel', x === b));
        selected = c.id;
        present.disabled = false;
        api.sound.play('click');
      };
      return b;
    }));
    present.onclick = () => {
      if (!selected) return;
      if (R.accept.includes(selected)) {
        present.disabled = true;
        cards.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        api.sound.play('applause');
        r++;
        fill.style.width = (r / d.rounds.length) * 100 + '%';
        box.append(say(R.reply));
        if (r < d.rounds.length) box.append(h('div', { class: 'w-actions' }, h('button', { class: 'btn primary', onclick: show }, 'Следующий слух')));
        else {
          if (d.turn) box.append(say(d.turn));
          next.classList.remove('hidden');
        }
        fb.clear();
      } else {
        api.mistake();
        api.sound.play('bad');
        fb.warn('**Не убедил{а}!** ' + (R.wrong || 'эта карточка про другое.'));
      }
    };
    box.replaceChildren(
      h('div', { class: 'al-count' }, `Слух ${r + 1} из ${d.rounds.length}`),
      say(R.claim, true),
      h('div', { class: 'vc-label' }, 'Выбери карточку правды:'), cards,
      h('div', { class: 'w-actions left' }, present),
    );
  };

  const say = (text, loud) => h('div', { class: 'msg bot' + (loud ? ' loud' : '') }, avatar(d.opponent.img, d.opponent.name, 'chat-ava'), h('div', { class: 'bubble' }, h('div', { class: 'msg-name' }, d.opponent.name), h('div', { class: 'msg-text', html: rich(text) })));

  el.append(h('div', { class: 'w-evidence' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), meter, box, fb.el, h('div', { class: 'w-actions' }, next)));
  show();
}
