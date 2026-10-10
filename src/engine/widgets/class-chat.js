// class-chat — фейк в чате класса. Три шага в одном окне мессенджера:
//  1) «Найди следы ИИ» на картинке (зоны-прямоугольники, нужно main из них; бонусные — по желанию);
//  2) «Подозрительные признаки сообщения» — клик по частям сообщения;
//  3) «Что сделаешь?» — варианты.
// data: {
//   chat: 'Чат 6-Б', sender, senderNote, parts: [{ text, flag?: true, why }], img,
//   regions: [{ id, x, y, w, h, label, bonus? }], need,
//   q, options: [{ text, ok, why }], after?, next?
// }
import { h, rich } from '../util.js';
import { phone, feedback, optionList } from './kit.js';

export default function classChat(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const side = h('div', { class: 'w-col' });
  const top = h('div', { class: 'mp-chat-top' }, backpackSvg(), h('b', {}, d.chat));

  // Сообщение: части текста кликабельны на шаге 2.
  const partEls = d.parts.map((p) => h('span', { class: 'cc-part' }, p.text));
  const pic = h('div', { class: 'cc-pic' }, h('img', { src: d.img, alt: '', draggable: 'false' }));
  const msg = h('div', { class: 'msg bot' },
    h('span', { class: 'chat-ava letter' }, 'Н'),
    h('div', { class: 'bubble' },
      h('div', { class: 'msg-name' }, d.sender, ' ', h('span', { class: 'cc-note' }, d.senderNote)),
      h('div', { class: 'msg-text' }, ...partEls),
      pic,
    ),
  );

  // Шаг 1: зоны на картинке.
  const foundZ = new Set();
  const counter = h('div', { class: 'vc-count' });
  const needMain = d.need ?? d.regions.filter((r) => !r.bonus).length;
  const mainFound = () => d.regions.filter((r) => !r.bonus && foundZ.has(r.id)).length;
  const upd1 = () => { counter.textContent = `Следы ИИ: ${mainFound()} из ${needMain}` + (d.regions.some((r) => r.bonus) ? ' (+ бонусный)' : ''); };
  upd1();
  let stage = 1;
  pic.addEventListener('pointerdown', (e) => {
    if (stage !== 1 && stage !== 1.5) return;
    const img = pic.querySelector('img').getBoundingClientRect();
    const x = (e.clientX - img.left) / img.width, y = (e.clientY - img.top) / img.height;
    const z = d.regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (z && !foundZ.has(z.id)) {
      foundZ.add(z.id);
      pic.append(h('div', { class: 'cc-zone', style: { left: z.x * 100 + '%', top: z.y * 100 + '%', width: z.w * 100 + '%', height: z.h * 100 + '%' } }));
      api.sound.play('good');
      fb.ok((z.bonus ? '**Бонус!** ' : '') + z.label);
      if (stage === 1) upd1(); // на шаге 2 счётчик уже считает признаки сообщения
      if (mainFound() >= needMain && stage === 1) toStage2();
    } else if (!z) {
      api.sound.play('click');
      const m = h('div', { class: 'insp-miss', style: { left: x * 100 + '%', top: y * 100 + '%' } }, '✕');
      pic.append(m);
      setTimeout(() => m.remove(), 700);
    }
  });

  // Шаг 2: части сообщения.
  const flags = d.parts.filter((p) => p.flag).length;
  let flagged = 0;
  const toStage2 = () => {
    stage = 1.5; // бонусную зону ещё можно найти
    side.replaceChildren(
      h('h3', { class: 'w-q' }, 'Шаг 2. Что подозрительно в самом сообщении?'),
      h('p', { class: 'w-intro' }, `Сообщение разбито на фразы в пунктирных рамках. Нажми на ${flags} подозрительные фразы.`),
      counter, fb.el,
    );
    counter.textContent = `Признаки: 0 из ${flags}`;
    msg.classList.add('cc-clickable');
    fb.info('Нажимай прямо на фразы в пунктирных рамках — в сообщении слева.');
    // Клик мимо фраз (по имени, аватару, фото) — подсказываем, куда нажимать.
    msg.addEventListener('click', (e) => {
      if (stage !== 1.5 || e.target.closest('.cc-part') || e.target.closest('.cc-pic')) return;
      fb.info('Нажимай на фразы в пунктирных рамках — это части текста сообщения.');
    });
    partEls.forEach((pe, i) => {
      const p = d.parts[i];
      pe.onclick = () => {
        if (pe.classList.contains('flag') || pe.classList.contains('plain')) return;
        if (p.flag) {
          pe.classList.add('flag');
          flagged++;
          counter.textContent = `Признаки: ${flagged} из ${flags}`;
          api.sound.play('good');
          fb.ok(p.why);
          if (flagged === flags) toStage3();
        } else {
          pe.classList.add('plain');
          api.mistake(); // промах (иначе «без ошибок» — перебором)
          api.sound.play('click');
          fb.info(p.why || 'Это обычная часть сообщения.');
        }
      };
    });
  };

  // Шаг 3: решение.
  const toStage3 = () => {
    stage = 3;
    msg.classList.remove('cc-clickable');
    const { el: list } = optionList(d.options, api, () => {
      if (d.after) side.append(h('div', { class: 'w-after', html: rich(d.after) }));
      next.classList.remove('hidden');
      side.append(h('div', { class: 'w-actions' }, next));
    });
    side.append(h('h3', { class: 'w-q', html: rich(d.q) }), list);
  };

  side.append(h('h3', { class: 'w-q' }, 'Шаг 1. Найди следы ИИ на фото'), h('p', { class: 'w-intro' }, 'Кликай по картинке там, где что-то не так.'), counter, fb.el);
  el.append(h('div', { class: 'w-two wide-left' }, phone(top, h('div', { class: 'chat-log tall' }, msg)), side));
}

function backpackSvg() {
  const d = document.createElement('span');
  d.className = 'chat-ava letter';
  d.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M8 6a4 4 0 0 1 8 0v1h1a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a3 3 0 0 1 3-3h1z" fill="#3d8bff"/><rect x="8" y="12" width="8" height="5" rx="1.5" fill="#fff"/></svg>';
  return d;
}
