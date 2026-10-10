// face-gate — шлюз Лаборатории: пропуск к считывателю → сравнение лица → «моргните» → открыто.
// Если игрок не дал согласие на фото (ctx.state.consent === false) — ввод кода с бейджа,
// но сначала надо прикрыть панель рукой (за спиной могут подсматривать).
// data: { intro, matchTo: 94, twofactor, liveness, cover, coverWarn, open, badgeTitle?, next? }
import { h, rich } from '../util.js';
import { feedback, wait } from './kit.js';

import { passPhoto } from './face-photo.js';

export default function faceGate(el, d, api) {
  const ctx = api.ctx;
  const fb = feedback();
  // Окно могут закрыть посреди проверки: тогда таймеры и клавиши больше ничего не делают.
  let alive = true, timer = 0, onKey = null;
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Войти');
  const screen = h('div', { class: 'fg-screen' });
  const light = h('div', { class: 'fg-light' });
  const side = h('div', { class: 'w-col' });
  el.append(h('div', { class: 'w-two' }, h('div', { class: 'fg-gate' }, light, screen), side));

  // Без согласия на фото на пропуске нет лица — только код.
  const badge = h('div', { class: 'fg-badge', draggable: 'false' },
    ctx.state.consent === false ? h('span', { class: 'fg-nophoto' }, '?') : h('img', { src: ctx.hero.portrait, alt: '' }),
    h('div', {}, h('b', {}, d.badgeTitle || 'Пропуск'), h('span', {}, ctx.hero.name), ctx.state.consent === false && h('span', { class: 'fg-code' }, 'Код: ' + ctx.state.code)),
  );
  const reader = h('div', { class: 'fg-reader' }, 'Считыватель');

  // 1. Пропуск к считывателю (клик по бейджу или по считывателю).
  const step1 = () => {
    screen.replaceChildren(h('div', { class: 'fg-msg' }, 'Приложите пропуск'));
    side.replaceChildren(d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), h('div', { class: 'fg-row' }, badge, reader), fb.el);
    fb.info('Нажми на свой пропуск, чтобы приложить его к считывателю.');
    const go = () => {
      badge.onclick = reader.onclick = null;
      badge.classList.add('applied');
      api.sound.play('beep');
      timer = setTimeout(ctx.state.consent === false ? stepCode : step2, 500);
    };
    badge.onclick = go;
    reader.onclick = go;
  };

  // 2. Сравнение лица.
  const step2 = async () => {
    const bar = h('i');
    const pct = h('b', {}, '0 %');
    // Камера шлюза: то же квадратное фото, что в пропуске, и точки распознавания.
    const cam = passPhoto(ctx.hero, { dots: 'animate' });
    api.sound.play('scan');
    cam.classList.add('small');
    screen.replaceChildren(cam, h('div', { class: 'fg-match' }, 'Совпадение ', pct, h('div', { class: 'nw-track' }, bar)));
    fb.info('Камера сравнивает лицо с шаблоном из пропуска…');
    await cam.ready;
    for (let p = 0; p <= d.matchTo; p += 2) { if (!alive) return; pct.textContent = p + ' %'; bar.style.width = p + '%'; await wait(28); }
    pct.textContent = d.matchTo + ' %';
    fb.ok(d.twofactor);
    await wait(500);
    if (!alive) return;
    // 3. Проверка «живости».
    const blink = h('button', { class: 'btn primary big' }, 'Моргнуть');
    screen.append(h('div', { class: 'fg-msg warn' }, 'Моргните'));
    side.append(h('div', { class: 'w-actions left' }, blink));
    const doBlink = async () => {
      blink.disabled = true;
      removeEventListener('keydown', onKey);
      cam.classList.add('blink');
      api.sound.play('click');
      await wait(300);
      if (!alive) return;
      cam.classList.remove('blink');
      fb.ok(d.liveness);
      opened();
    };
    onKey = (e) => { if (e.code === 'Space' && !blink.disabled) { e.preventDefault(); doBlink(); } };
    addEventListener('keydown', onKey);
    blink.onclick = doBlink;
  };

  // 2б. Код (без согласия на фото).
  const stepCode = () => {
    let covered = false;
    let typed = '';
    const disp = h('div', { class: 'fg-code-disp' }, '_ _ _ _');
    const cover = h('button', { class: 'btn' }, d.cover);
    const pad = h('div', { class: 'fg-pad' }, ...'1234567890'.split('').map((n) => {
      const b = h('button', {}, n);
      b.onclick = () => {
        if (!covered) { fb.warn(d.coverWarn); api.mistake(); api.sound.play('bad'); return; }
        typed += n;
        disp.textContent = typed.padEnd(4, '_').split('').join(' ');
        api.sound.play('beep');
        if (typed.length === 4) {
          if (typed === ctx.state.code) { fb.ok('Код верный. Двойная проверка: пропуск + код.'); opened(); }
          else { fb.warn('код не тот. Посмотри на свой пропуск.'); typed = ''; disp.textContent = '_ _ _ _'; }
        }
      };
      return b;
    }));
    cover.onclick = () => { covered = true; cover.disabled = true; pad.classList.add('covered'); api.sound.play('good'); fb.ok('Правильно: панель прикрыта, код не подсмотрят.'); };
    screen.replaceChildren(h('div', { class: 'fg-msg' }, 'Введите код с пропуска'), disp, pad);
    side.append(h('div', { class: 'w-actions left' }, cover));
    fb.info('Перед тобой панель для кода.');
  };

  const opened = async () => {
    light.classList.add('green');
    api.sound.play('star');
    screen.append(h('div', { class: 'fg-msg ok' }, 'Доступ разрешён'));
    await wait(400);
    if (!alive) return;
    fb.ok(d.open);
    side.append(h('div', { class: 'w-actions' }, next));
    next.classList.remove('hidden');
  };

  step1();
  return () => { alive = false; clearTimeout(timer); if (onKey) removeEventListener('keydown', onKey); };
}
