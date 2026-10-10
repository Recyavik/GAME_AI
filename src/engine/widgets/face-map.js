// face-map — «Как ИИ видит лицо»: поставить 5 точек на лице, увидеть вместо лица числа.
// data: { intro, numbers: [['глаз — глаз', '1,00'], …], caption, next? }
import { h, rich } from '../util.js';
import { feedback, svgEl, wait } from './kit.js';
import { faceSvg, FACE_POINTS } from './faces.js';

const NS = 'http://www.w3.org/2000/svg';

export default function faceMap(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const pic = svgEl(faceSvg({ glasses: false }), 'fm-pic');
  const svg = pic.querySelector('svg');
  const layer = document.createElementNS(NS, 'g');
  svg.append(layer);
  const task = h('div', { class: 'fm-task' });
  const table = h('table', { class: 'fm-nums hidden' });
  let k = 0;

  const ask = () => {
    task.innerHTML = `Точка ${k + 1} из 5: поставь на <b>${FACE_POINTS[k].label}</b>`;
  };
  ask();
  fb.info('Нажимай прямо на лицо.');

  svg.addEventListener('pointerdown', async (e) => {
    if (k >= FACE_POINTS.length) return;
    const r = svg.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * 400;
    const sy = ((e.clientY - r.top) / r.height) * 480;
    const t = FACE_POINTS[k];
    const tol = 30 * (400 / r.width) + 10;
    if (Math.hypot(sx - t.x, sy - t.y) > tol) {
      fb.info(`Мимо. Нужна точка: ${t.label}.`);
      api.sound.play('click');
      return;
    }
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', t.x); c.setAttribute('cy', t.y); c.setAttribute('r', 11);
    c.setAttribute('class', 'fm-dot');
    layer.append(c);
    api.sound.play('pop');
    k++;
    if (k < FACE_POINTS.length) { ask(); fb.ok('Есть!'); return; }
    // Все 5 точек: соединяем линиями, лицо растворяется, остаются числа.
    task.innerHTML = '<b>Готово!</b> Смотри, что остаётся для ИИ:';
    const P = Object.fromEntries(FACE_POINTS.map((p) => [p.id, p]));
    for (const [a, b] of [['eyeL', 'eyeR'], ['eyeL', 'nose'], ['eyeR', 'nose'], ['nose', 'mouthL'], ['nose', 'mouthR'], ['mouthL', 'mouthR']]) {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', P[a].x); l.setAttribute('y1', P[a].y); l.setAttribute('x2', P[b].x); l.setAttribute('y2', P[b].y);
      l.setAttribute('class', 'fm-line');
      layer.prepend(l);
    }
    await wait(500);
    pic.classList.add('dissolve');
    table.replaceChildren(...d.numbers.map(([n, v]) => h('tr', {}, h('td', {}, n), h('td', {}, v))));
    table.classList.remove('hidden');
    api.sound.play('star');
    fb.ok(d.caption);
    next.classList.remove('hidden');
  });

  el.append(
    h('div', { class: 'w-two' },
      pic,
      h('div', { class: 'w-col' },
        d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }),
        task, table, fb.el,
        h('div', { class: 'w-actions' }, next),
      ),
    ),
  );
}
