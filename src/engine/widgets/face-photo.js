// Фото на пропуск из портрета героя.
// hero.face = {
//   pts:  [[x, y], …] — глаза, нос, уголки рта в долях ширины/высоты ПОРТРЕТА (замерено по сетке);
//   crop: [cx, cy, side] — центр квадрата (доли ширины/высоты) и сторона (доля высоты портрета).
// }
// liveCam(hero)  — «камера»: весь портрет + квадратная рамка там, где будет фото.
// passPhoto(hero, { dots }) — квадратное фото (canvas) с точками распознавания поверх.
import { h } from '../util.js';
import { wait } from './kit.js';

const DEFAULT_FACE = { pts: [[0.47, 0.32], [0.63, 0.32], [0.56, 0.38], [0.5, 0.42], [0.62, 0.42]], crop: [0.54, 0.31, 0.55] };

// Квадрат кадра в пикселях портрета.
function cropRect(img, face) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const [cx, cy, s] = face.crop;
  const side = s * H;
  return { x: cx * W - side / 2, y: cy * H - side / 2, side, W, H };
}

function loaded(img) {
  return img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }); // не загрузилась — не зависаем
}

// Камера: портрет целиком, поверх — квадратная рамка будущего фото.
export function liveCam(hero) {
  const face = hero.face || DEFAULT_FACE;
  const img = h('img', { src: hero.portrait, alt: '' });
  const frame = h('div', { class: 'be-frame' });
  const holder = h('div', { class: 'be-img' }, img, frame);
  const cam = h('div', { class: 'be-cam' }, holder);
  loaded(img).then(() => {
    const r = cropRect(img, face);
    holder.style.aspectRatio = `${r.W} / ${r.H}`;
    Object.assign(frame.style, { left: (r.x / r.W) * 100 + '%', top: (r.y / r.H) * 100 + '%', width: (r.side / r.W) * 100 + '%', height: (r.side / r.H) * 100 + '%' });
  });
  return cam;
}

// Квадратное фото на пропуск; dots: true — сразу с точками, 'animate' — точки появляются по одной.
export function passPhoto(hero, { dots = true, onDot } = {}) {
  const face = hero.face || DEFAULT_FACE;
  const canvas = h('canvas', { width: 360, height: 360 });
  const box = h('div', { class: 'be-photo' }, canvas);
  const img = new Image();
  img.src = hero.portrait;
  const ready = loaded(img).then(async () => {
    const r = cropRect(img, face);
    const g = canvas.getContext('2d');
    g.fillStyle = '#dfe9f7';
    g.fillRect(0, 0, 360, 360);
    g.drawImage(img, r.x, r.y, r.side, r.side, 0, 0, 360, 360);
    if (!dots) return;
    for (const [px, py] of face.pts) {
      const x = ((px * r.W - r.x) / r.side) * 100, y = ((py * r.H - r.y) / r.side) * 100;
      box.append(h('i', { class: 'be-dot', style: { left: x + '%', top: y + '%' } }));
      if (dots === 'animate') { onDot?.(); await wait(180); }
    }
  });
  box.ready = ready;
  return box;
}
