// app-permissions — телефон с приложением: 1) какое фото дать, 2) какие разрешения оставить.
// data: {
//   app: { name, color }, intro,
//   photos: [{ img, label, ok, best?, why }], photoTask,
//   perms: [{ id, label, options: ['Всегда', 'Только сейчас', 'Нет'], start, right, why }], permsTask,
//   done, next?
// }
import { h, rich, shuffle } from '../util.js';
import { feedback, phone } from './kit.js';

export default function appPermissions(el, d, api) {
  const fb = feedback();
  const body = h('div', { class: 'ap-body' });
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const appIcon = h('span', { class: 'ap-icon', style: { background: d.app.color } }, catSvg());
  const top = h('div', { class: 'ap-top' }, appIcon, h('b', {}, d.app.name));

  // Часть 1: выбор фото.
  const part1 = () => {
    fb.info(d.photoTask);
    const grid = h('div', { class: 'ap-photos' });
    for (const p of shuffle(d.photos)) {
      const b = h('button', { class: 'ap-photo' }, h('img', { src: p.img, alt: '' }), h('span', {}, p.label));
      b.onclick = () => {
        if (b.disabled) return;
        if (p.ok) {
          grid.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          b.classList.add('ok');
          fb.ok((p.best ? '**Супер-выбор!** ' : '') + p.why);
          api.sound.play('good');
          const go = h('button', { class: 'btn primary', onclick: part2 }, 'Дальше: разрешения');
          screen.append(h('div', { class: 'w-actions' }, go));
        } else {
          b.classList.add('bad');
          b.disabled = true;
          fb.warn(p.why);
          api.mistake();
          api.sound.play('bad');
        }
      };
      grid.append(b);
    }
    screen.replaceChildren(h('div', { class: 'ap-h' }, 'Загрузи фото для мультяшки'), grid);
  };

  // Часть 2: разрешения (по умолчанию всё включено — как часто бывает при установке).
  const part2 = () => {
    fb.info(d.permsTask);
    const state = {};
    const rows = d.perms.map((p) => {
      state[p.id] = p.start;
      const seg = h('div', { class: 'seg' });
      p.options.forEach((o) => {
        const b = h('button', { class: o === p.start ? 'on' : '' }, o);
        b.onclick = () => {
          state[p.id] = o;
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          row.classList.remove('bad', 'ok');
          api.sound.play('click');
        };
        seg.append(b);
      });
      const row = h('div', { class: 'perm' }, h('span', { class: 'perm-l' }, p.label), seg);
      return { p, row };
    });
    const check = h('button', { class: 'btn primary' }, 'Готово');
    check.onclick = () => {
      const wrong = rows.filter((r) => state[r.p.id] !== r.p.right);
      rows.forEach((r) => {
        r.row.classList.toggle('bad', wrong.includes(r));
        r.row.classList.toggle('ok', !wrong.includes(r));
      });
      if (wrong.length) {
        api.mistake();
        api.sound.play('bad');
        fb.warn(wrong.map((r) => `${r.p.label}: ${r.p.why}`).join('\n'));
      } else {
        api.sound.play('star');
        check.disabled = true;
        rows.forEach((r) => r.row.querySelectorAll('button').forEach((b) => { b.disabled = true; }));
        fb.ok(d.done);
        next.classList.remove('hidden');
      }
    };
    screen.replaceChildren(h('div', { class: 'ap-h' }, 'Приложение просит доступ'), ...rows.map((r) => r.row), h('div', { class: 'w-actions' }, check));
  };

  const screen = h('div', { class: 'ap-screen' });
  el.append(
    h('div', { class: 'w-two' },
      phone(top, screen),
      h('div', { class: 'w-col' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), body, fb.el, h('div', { class: 'w-actions' }, next)),
    ),
  );
  part1();
}

function catSvg() {
  const d = document.createElement('span');
  d.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9 5 3l4 4h6l4-4 1 6c1 2 1 4 0 6-1 4-4 6-8 6s-7-2-8-6c-1-2-1-4 0-6z" fill="#fff"/><circle cx="9" cy="12" r="1.3" fill="#333"/><circle cx="15" cy="12" r="1.3" fill="#333"/><path d="M10.5 15q1.5 1.2 3 0" stroke="#333" fill="none" stroke-width="1.2"/></svg>';
  return d;
}
