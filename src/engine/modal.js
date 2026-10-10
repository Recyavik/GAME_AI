// Модальные карточки, тосты, конфетти.
import { h, rich } from './util.js';
import { sound } from './sound.js';

const ui = () => document.getElementById('ui');

// Окна, которые закрываются по Esc. Esc закрывает самое верхнее (последнее открытое).
// onEsc(узел, закрыть) → функция «снять с учёта». Окно задания (станция) спрашивает «Выйти?» само.
const escStack = [];
export function onEsc(node, close) {
  const item = { node, close };
  escStack.push(item);
  return () => { const i = escStack.indexOf(item); if (i >= 0) escStack.splice(i, 1); };
}
// ?. — модуль загружается и без браузера (npm run check).
globalThis.addEventListener?.('keydown', (e) => {
  if (e.code !== 'Escape' || document.querySelector('.eyes-wrap')) return;
  while (escStack.length && !escStack.at(-1).node.isConnected) escStack.pop();
  const top = escStack.at(-1);
  if (!top) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  escStack.pop();
  top.close();
}, true);

// Показать модалку. buttons: [{ text, value, primary }]. Возвращает Promise<value>.
// body — строка (rich-текст) или DOM-узел.
export function modal({ title = '', body = '', buttons = [{ text: 'Понятно', value: true, primary: true }], cls = '', img = null, closable = true }) {
  return new Promise((resolve) => {
    const close = (v) => {
      if (closed) return;
      closed = true;
      offEsc?.();
      sound.play('click');
      wrap.classList.add('out');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => wrap.remove(), 180);
      resolve(v);
    };
    let closed = false;
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (buttons.length === 1) { e.preventDefault(); e.stopPropagation(); close(buttons[0].value); }
        // Фокус остался на кнопке под окном — не даём «нажать» её вслепую.
        else if (!wrap.contains(document.activeElement)) { e.preventDefault(); e.stopPropagation(); }
      }
    };
    const wrap = h('div', { class: 'overlay' },
      h('div', { class: 'modal ' + cls },
        img && h('img', { class: 'modal-img', src: img, alt: '' }),
        title && h('h2', { html: rich(title) }),
        typeof body === 'string' ? h('div', { class: 'modal-body', html: rich(body) }) : body,
        buttons.length > 0 && h('div', { class: 'modal-btns' },
          buttons.map((b) => h('button', { class: 'btn' + (b.primary ? ' primary' : ''), onclick: () => close(b.value) }, b.text)),
        ),
      ),
    );
    if (closable) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(undefined); });
    document.addEventListener('keydown', onKey, true);
    ui().append(wrap);
    const offEsc = closable ? onEsc(wrap, () => close(undefined)) : null;
    (wrap.querySelector('.modal-btns .btn.primary') || wrap.querySelector('.modal-btns .btn'))?.focus({ preventScroll: true });
    sound.play('open');
  });
}

// text — rich-текст сценария; html — уже готовая разметка (текст внутри экранирован заранее).
export function toast(text, kind = 'info', ms = 2600, { html = false } = {}) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts' }); ui().append(box); }
  const t = h('div', { class: 'toast ' + kind, html: html ? text : rich(text) });
  box.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// «Подпрыгнуть» элементу (счётчики).
export function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

export function confetti(ms = 3500) {
  const c = h('canvas', { class: 'confetti' });
  ui().append(c);
  const ctx = c.getContext('2d');
  c.width = innerWidth;
  c.height = innerHeight;
  const COL = ['#7c4dff', '#ff8a3d', '#1fb67a', '#f5c518', '#3ab0ff', '#ef5da8'];
  const P = Array.from({ length: 160 }, () => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    r: Math.random() * 6, s: 5 + Math.random() * 7, c: COL[(Math.random() * COL.length) | 0],
  }));
  const t0 = performance.now();
  const step = (t) => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of P) {
      p.x += p.vx; p.y += p.vy; p.r += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(step);
    else c.remove();
  };
  requestAnimationFrame(step);
}
