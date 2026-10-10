// suspicious-chat — переписка в игровом чате с «другом»: отметить тревожные признаки, затем выбрать действие.
// data: {
//   intro, contact: { name, img, note },
//   messages: [{ from: 'them'|'me', time, text, sign?: 'id', why? }],   // sign — это признак (можно отметить)
//   signs: { id: 'пояснение' }, timeSign: 'id' — клик по времени сообщения тоже признак,
//   found, card?: 'alive' (выдать карточку после признаков),
//   q, options: [{ text, ok, why }], after?, next?
// }
import { h, rich } from '../util.js';
import { phone, avatar, feedback, optionList, wait } from './kit.js';

export default function suspiciousChat(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const side = h('div', { class: 'w-col' });
  const log = h('div', { class: 'chat-log tall' });
  const marked = new Set();
  const need = Object.keys(d.signs).length;
  const counter = h('div', { class: 'vc-count' }, `Признаки: 0 из ${need}`);
  let ready = false;
  let alive = true;

  const mark = (id, node) => {
    if (!ready) return;
    if (!id) { if (!node.classList.contains('plain')) api.mistake(); node.classList.add('plain'); api.sound.play('click'); fb.info('Это обычное сообщение — само по себе оно не опасно.'); return; }
    if (marked.has(id)) return;
    marked.add(id);
    document.querySelectorAll(`[data-sign="${id}"]`).forEach((n) => n.classList.add('flag'));
    counter.textContent = `Признаки: ${marked.size} из ${need}`;
    api.sound.play('good');
    fb.ok(d.signs[id]);
    if (marked.size === need) afterSigns();
  };

  const top = h('div', { class: 'mp-chat-top' }, avatar(d.contact.img, d.contact.name, 'chat-ava'), h('div', {}, h('b', {}, d.contact.name), h('div', { class: 'cc-note' }, d.contact.note)));

  (async () => {
    for (const m of d.messages) {
      await wait(m.from === 'me' ? 500 : 750);
      if (!alive) return;
      const timeEl = h('span', { class: 'msg-time click', 'data-sign': d.timeSign && m.from === 'them' ? d.timeSign : null }, m.time);
      const textEl = h('div', { class: 'msg-text', 'data-sign': m.sign || null, html: rich(m.text) });
      const node = h('div', { class: 'msg ' + (m.from === 'me' ? 'me' : 'bot') },
        m.from !== 'me' && avatar(d.contact.img, d.contact.name, 'chat-ava'),
        h('div', { class: 'bubble' }, textEl, timeEl),
      );
      textEl.onclick = () => mark(m.sign, textEl);
      if (m.from === 'them' && d.timeSign) timeEl.onclick = (e) => { e.stopPropagation(); mark(d.timeSign, timeEl); };
      log.append(node);
      log.scrollTop = log.scrollHeight;
      api.sound.play('pop');
    }
    ready = true;
    log.classList.add('cc-clickable');
    fb.info('Кликай по сообщениям и по времени отправки — что здесь тревожит?');
  })();

  const afterSigns = () => {
    ready = false;
    log.classList.remove('cc-clickable');
    side.append(h('div', { class: 'w-after', html: rich(d.found) }));
    const { el: list } = optionList(d.options, api, () => {
      if (d.card) api.ctx.progress?.giveCard(d.card); // карточка — когда задание решено целиком
      if (d.after) side.append(h('div', { class: 'w-after', html: rich(d.after) }));
      next.classList.remove('hidden');
      side.append(h('div', { class: 'w-actions' }, next));
    });
    side.append(h('h3', { class: 'w-q', html: rich(d.q) }), list);
  };

  side.append(d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), counter, fb.el);
  el.append(h('div', { class: 'w-two' }, phone(top, log), side));
  return () => { alive = false; };
}
