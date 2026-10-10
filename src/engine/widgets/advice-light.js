// advice-light — «Светофор советов»: совет ИИ → «Сделаю» / «Сначала проверю или спрошу взрослого» / «Не буду».
// data: {
//   intro, bot: { name, img },
//   items: [{ text, accept: ['green'|'yellow'|'red', …], why, wrong: { green: '…', … } }],
//   rule: ['Совет', 'даёт', 'ИИ', '—', 'решает', 'человек'], lines: ['…'], next?
// }
import { h, rich } from '../util.js';
import { feedback, avatar, wait } from './kit.js';

const LIGHTS = [['green', 'Сделаю'], ['yellow', 'Сначала проверю или спрошу взрослого'], ['red', 'Не буду']];

export default function adviceLight(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const box = h('div', { class: 'al-box' });
  let k = 0;

  const show = () => {
    const it = d.items[k];
    fb.clear();
    const btns = h('div', { class: 'al-btns' }, LIGHTS.map(([c, t]) => {
      const b = h('button', { class: 'al-btn ' + c }, h('i'), t);
      b.onclick = async () => {
        if (b.disabled) return;
        if (it.accept.includes(c)) {
          btns.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          b.classList.add('chosen');
          fb.ok(it.why);
          api.sound.play('good');
          k++;
          box.append(h('div', { class: 'w-actions' }, h('button', { class: 'btn primary', onclick: () => (k < d.items.length ? show() : finale()) }, k < d.items.length ? 'Следующий совет' : 'Итог')));
        } else {
          b.disabled = true;
          b.classList.add('bad');
          fb.warn(it.wrong?.[c] || 'подумай, к чему приведёт такой выбор.');
          api.mistake();
          api.sound.play('bad');
        }
      };
      return b;
    }));
    box.replaceChildren(
      h('div', { class: 'al-count' }, `Совет ${k + 1} из ${d.items.length}`),
      h('div', { class: 'msg bot' }, avatar(d.bot.img, d.bot.name, 'chat-ava'), h('div', { class: 'bubble' }, h('div', { class: 'msg-name' }, d.bot.name), h('div', { class: 'msg-text', html: rich(it.text) }))),
      btns,
    );
  };

  const finale = async () => {
    fb.clear();
    const big = h('div', { class: 'al-rule' });
    box.replaceChildren(big);
    // Пробел — отдельным текстовым узлом: у inline-block-слова пробел в конце «съедается».
    for (const w of d.rule) { big.append(h('span', {}, w), ' '); api.sound.play('pop'); await wait(260); }
    box.append(h('ul', { class: 'al-lines' }, d.lines.map((l) => h('li', { html: rich(l) }))));
    api.sound.play('star');
    next.classList.remove('hidden');
  };

  el.append(h('div', { class: 'w-advice' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), box, fb.el, h('div', { class: 'w-actions' }, next)));
  show();
}
