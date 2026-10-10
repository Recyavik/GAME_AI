// chat-trap — чат с ИИ-помощником, который просит лишнее. На каждую просьбу: вежливый отказ или согласие.
// data: {
//   intro, bot: { name, img },
//   asks: [{ text, refuse, agree, why }],   // why — почему отправлять нельзя (показывается на «Стоп!»)
//   final, next?
// }
import { h, rich, shuffle } from '../util.js';
import { phone, bubble, avatar, feedback, wait } from './kit.js';

export default function chatTrap(el, d, api) {
  const fb = feedback();
  const log = h('div', { class: 'chat-log' });
  const replies = h('div', { class: 'chat-choices' });
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  let alive = true;
  const top = h('div', { class: 'mp-chat-top' }, avatar(d.bot.img, d.bot.name, 'chat-ava'), h('b', {}, d.bot.name));
  const push = (node) => { log.append(node); log.scrollTop = log.scrollHeight; };

  (async () => {
    for (const a of d.asks) {
      await wait(500);
      if (!alive) return;
      push(bubble('bot', rich(a.text), { name: d.bot.name, img: d.bot.img }));
      api.sound.play('pop');
      await new Promise((resolve) => {
        replies.replaceChildren(...shuffle([['refuse', a.refuse], ['agree', a.agree]]).map(([kind, text]) => {
          const b = h('button', { class: 'opt', html: rich(text) });
          b.onclick = () => {
            if (kind === 'refuse') {
              replies.replaceChildren();
              push(bubble('me', rich(text)));
              api.sound.play('good');
              fb.ok(a.why);
              resolve();
            } else {
              api.mistake();
              api.sound.play('bad');
              b.disabled = true;
              b.classList.add('bad');
              fb.el.className = 'fb warn';
              fb.el.innerHTML = rich('**Стоп!** Посмотри, что ты {собирался|собиралась} отправить: ' + a.why);
            }
          };
          return b;
        }));
      });
    }
    await wait(500);
    if (!alive) return;
    push(bubble('bot', rich(d.final), { name: d.bot.name, img: d.bot.img }));
    api.sound.play('star');
    next.classList.remove('hidden');
  })();

  el.append(h('div', { class: 'w-two' },
    phone(top, log),
    h('div', { class: 'w-col' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), h('div', { class: 'vc-label' }, 'Твой ответ:'), replies, fb.el, h('div', { class: 'w-actions' }, next)),
  ));
  return () => { alive = false; };
}
