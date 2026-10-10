// prompt-builder — «ИИ рисует по описанию»: плитки «Кто / Где / Как» → картинка проявляется из шума.
// data: {
//   intro, rows: [{ title, key, options: [{ id, label }] }],   // key: 'who' | 'where' | 'style'
//   images: { 'cat_space': url, … },   // ключ — who_where
//   min: 1, doneText, next?
// }
// Стили рисуются фильтрами canvas: watercolor (размытие + бумага), cartoon (как есть), pixel (48 px без сглаживания).
import { h, rich } from '../util.js';
import { feedback, wait } from './kit.js';

export default function promptBuilder(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const pick = {};
  const made = new Set();
  const go = h('button', { class: 'btn primary', disabled: true }, 'Нарисовать');
  const prompt = h('div', { class: 'combo-prompt' });
  const canvas = h('canvas', { class: 'pb-canvas', width: 512, height: 512 });
  const ctx2 = canvas.getContext('2d');
  ctx2.fillStyle = '#eef0f6';
  ctx2.fillRect(0, 0, 512, 512);
  let busy = false;

  const label = (row) => row.options.find((o) => o.id === pick[row.key])?.label;
  const upd = () => {
    prompt.innerHTML = 'Запрос: <b>' + (d.rows.map(label).filter(Boolean).join(' ') || '…') + '</b>';
    go.disabled = busy || d.rows.some((r) => !pick[r.key]);
  };

  const rows = d.rows.map((row) =>
    h('div', { class: 'combo-part' },
      h('div', { class: 'combo-title' }, row.title),
      h('div', { class: 'combo-opts' }, row.options.map((o) => {
        const b = h('button', { class: 'chip' }, o.label);
        b.onclick = () => {
          pick[row.key] = o.id;
          b.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
          api.sound.play('click');
          upd();
        };
        return b;
      })),
    ));

  go.onclick = async () => {
    busy = true;
    upd();
    const img = await loadImg(d.images[`${pick.who}_${pick.where}`]);
    api.sound.play('whoosh');
    // 12 шагов: картинка проступает из цветного шума.
    for (let s = 1; s <= 12; s++) {
      drawStyled(ctx2, img, pick.style);
      noiseOver(ctx2, 1 - s / 12);
      await wait(240);
    }
    drawStyled(ctx2, img, pick.style);
    api.sound.play('star');
    made.add(`${pick.who}_${pick.where}_${pick.style}`);
    busy = false;
    upd();
    fb.ok(made.size >= (d.min || 1) ? d.doneText : 'Попробуй ещё один запрос!');
    if (made.size >= (d.min || 1)) next.classList.remove('hidden');
  };

  upd();
  el.append(h('div', { class: 'w-two' },
    h('div', { class: 'w-col' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), rows, prompt, h('div', { class: 'w-actions left' }, go), fb.el, h('div', { class: 'w-actions' }, next)),
    canvas,
  ));
}

function loadImg(src) {
  return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src; }); // ошибка загрузки не блокирует кнопку
}

function drawStyled(c, img, style) {
  if (!img.naturalWidth) return; // картинка не загрузилась — холст остаётся пустым
  c.save();
  c.filter = 'none';
  c.imageSmoothingEnabled = true;
  if (style === 'pixel') {
    const t = document.createElement('canvas');
    t.width = t.height = 48;
    t.getContext('2d').drawImage(img, 0, 0, 48, 48);
    c.imageSmoothingEnabled = false;
    c.drawImage(t, 0, 0, 512, 512);
  } else if (style === 'watercolor') {
    c.filter = 'blur(2.2px) saturate(1.25) brightness(1.06)';
    c.drawImage(img, 0, 0, 512, 512);
    c.filter = 'none';
    // «Бумага»: светлые пятна и зерно.
    c.globalAlpha = 0.18;
    for (let i = 0; i < 260; i++) {
      c.fillStyle = Math.random() < 0.5 ? '#fff' : '#f2e6cf';
      c.beginPath();
      c.arc(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 22, 0, 7);
      c.fill();
    }
  } else {
    c.drawImage(img, 0, 0, 512, 512);
  }
  c.restore();
}

function noiseOver(c, k) {
  if (k <= 0) return;
  const step = 16;
  c.save();
  c.globalAlpha = k;
  for (let y = 0; y < 512; y += step) {
    for (let x = 0; x < 512; x += step) {
      c.fillStyle = `hsl(${Math.random() * 360} 70% ${40 + Math.random() * 40}%)`;
      c.fillRect(x, y, step, step);
    }
  }
  c.restore();
}
