// Зарядка для глаз (~3 минуты): через 20 минут игры — предложение сделать зарядку;
// в любой момент — Ctrl + E или кнопка «Глаза» (одиночная E рядом с WASD — легко нажать случайно). Игра на время зарядки стоит (окно-overlay).
//
// Экран: зверёк движется по траектории, внизу — лицо с большими глазами: зрачки следят
// за зверьком, лицо моргает и зажмуривается вместе с игроком. Упражнения можно пропускать.
//
// Картинки (необязательно; без них всё рисуется кодом) — art = {
//   face: { open, closed, squeeze, iris, eyes: [[x, y], [x, y]] (центры глаз в долях холста),
//           irisSize (доля ширины холста), irisAnchorY, move: [rx, ry] (ход зрачка в долях холста) },
//   frog: [сидит, прыжок], dog: [кадр1, кадр2], butterfly: [раскрыты, сложены], bee: [кадр1, кадр2],
//   star, window (фон «вдаль»), palms (фон «тёплые ладони»)
// }. Все PNG — квадратные холсты БЕЗ обрезки полей (координаты заданы относительно холста).
import { h } from './util.js';
import { sound } from './sound.js';
import { toast } from './modal.js';

const REMIND_AFTER = 20 * 60; // секунд игры до напоминания
const LATER = 5 * 60; // «Позже» — через 5 минут

// ---------- Зверьки (SVG, рисуются кодом) ----------
const ANIMALS = {
  frog: `<svg viewBox="0 0 120 100"><ellipse cx="60" cy="70" rx="44" ry="26" fill="#58b97a"/><ellipse cx="60" cy="78" rx="28" ry="14" fill="#c8f0b4"/>
    <circle cx="38" cy="38" r="16" fill="#58b97a"/><circle cx="82" cy="38" r="16" fill="#58b97a"/><circle cx="38" cy="36" r="10" fill="#fff"/><circle cx="82" cy="36" r="10" fill="#fff"/>
    <circle cx="40" cy="37" r="5" fill="#1d1d2b"/><circle cx="84" cy="37" r="5" fill="#1d1d2b"/><path d="M42 68 Q60 80 78 68" stroke="#2d6b3f" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="22" cy="92" rx="16" ry="6" fill="#4aa56a"/><ellipse cx="98" cy="92" rx="16" ry="6" fill="#4aa56a"/></svg>`,
  dog: `<svg viewBox="0 0 120 110"><ellipse cx="24" cy="44" rx="15" ry="28" fill="#8a5a36" transform="rotate(18 24 44)"/><ellipse cx="96" cy="44" rx="15" ry="28" fill="#8a5a36" transform="rotate(-18 96 44)"/>
    <circle cx="60" cy="58" r="40" fill="#d9a066"/><ellipse cx="60" cy="76" rx="22" ry="17" fill="#f5dcc0"/><circle cx="45" cy="52" r="7" fill="#1d1d2b"/><circle cx="75" cy="52" r="7" fill="#1d1d2b"/>
    <circle cx="47" cy="50" r="2.4" fill="#fff"/><circle cx="77" cy="50" r="2.4" fill="#fff"/><ellipse cx="60" cy="69" rx="8" ry="6" fill="#1d1d2b"/>
    <path d="M52 80 Q60 88 68 80" stroke="#1d1d2b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M57 84 Q60 98 64 84" fill="#e5484d"/></svg>`,
  butterfly: `<svg viewBox="0 0 120 100"><ellipse cx="36" cy="36" rx="28" ry="24" fill="#9a6bd8"/><ellipse cx="84" cy="36" rx="28" ry="24" fill="#9a6bd8"/>
    <ellipse cx="40" cy="72" rx="20" ry="16" fill="#ef7fb0"/><ellipse cx="80" cy="72" rx="20" ry="16" fill="#ef7fb0"/><circle cx="34" cy="34" r="8" fill="#ffc53d"/><circle cx="86" cy="34" r="8" fill="#ffc53d"/>
    <rect x="55" y="22" width="10" height="64" rx="5" fill="#30344a"/><path d="M58 24 Q50 6 42 8 M62 24 Q70 6 78 8" stroke="#30344a" stroke-width="3" fill="none"/></svg>`,
  bee: `<svg viewBox="0 0 120 100"><ellipse cx="46" cy="30" rx="20" ry="14" fill="#cfe6ff" opacity=".9"/><ellipse cx="74" cy="30" rx="20" ry="14" fill="#cfe6ff" opacity=".9"/>
    <ellipse cx="60" cy="60" rx="38" ry="28" fill="#ffc53d"/><path d="M44 36 Q40 60 44 86 M60 32 Q56 60 60 88 M76 36 Q72 60 76 86" stroke="#30344a" stroke-width="9" fill="none"/>
    <circle cx="94" cy="56" r="16" fill="#30344a"/><circle cx="99" cy="52" r="4" fill="#fff"/><path d="M18 60 L6 60" stroke="#30344a" stroke-width="5" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#ff7a59"/><circle cx="50" cy="50" r="14" fill="#fff"/></svg>`,
};

// ---------- Упражнения ----------
// path(t) → [x, y] в долях поля (0..1); t — секунды с начала упражнения.
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => 0.5 - Math.cos(Math.PI * k) / 2;
const STEPS = [
  { id: 'start', title: 'Приготовься', text: 'Сядь ровно, расслабь плечи. **Голова не двигается — работают только глаза.**', sec: 8, face: 'open', animal: 'star', path: () => [0.5, 0.42] },
  {
    id: 'frog', title: 'Лягушка прыгает', text: 'Следи глазами за лягушкой: прыг — влево, прыг — вправо.', sec: 24, face: 'follow', animal: 'frog',
    path: (t) => {
      const pts = [0.12, 0.31, 0.5, 0.69, 0.88, 0.69, 0.5, 0.31];
      const hop = 1.2, i = Math.floor(t / hop), k = (t % hop) / hop;
      const a = pts[i % pts.length], b = pts[(i + 1) % pts.length];
      return [lerp(a, b, ease(k)), 0.5 - Math.sin(Math.PI * k) * 0.18];
    },
  },
  {
    id: 'updown', title: 'Пчёлка вверх-вниз', text: 'Смотри на пчёлку. Она летает то вверх, то вниз.', sec: 22, face: 'follow', animal: 'bee',
    path: (t) => [0.5 + Math.sin(t * 0.7) * 0.04, 0.45 - Math.sin((t * Math.PI * 2) / 4.5) * 0.36],
  },
  {
    id: 'diag', title: 'По диагонали', text: 'Собачка бежит из угла в угол — проводи её взглядом.', sec: 24, face: 'follow', animal: 'dog',
    path: (t) => {
      const cyc = 8, k = (t % cyc) / cyc, first = Math.floor(t / cyc) % 2 === 0; // медленнее — шаги совпадают с бегом
      const s = Math.sin(k * Math.PI * 2) * 0.5 + 0.5;
      return first ? [lerp(0.15, 0.85, s), lerp(0.12, 0.8, s)] : [lerp(0.85, 0.15, s), lerp(0.12, 0.8, s)];
    },
  },
  {
    id: 'circle', title: 'Бабочка по кругу', text: 'Бабочка летит по кругу. Сначала по часовой стрелке, потом против.', sec: 24, face: 'follow', animal: 'butterfly',
    path: (t) => {
      const dir = t < 12 ? 1 : -1, a = dir * (t * Math.PI * 2) / 6 - Math.PI / 2;
      return [0.5 + Math.cos(a) * 0.3, 0.45 + Math.sin(a) * 0.33];
    },
  },
  {
    id: 'eight', title: 'Пчёлка-восьмёрка', text: 'Пчёлка рисует лежащую восьмёрку. Следи за ней.', sec: 22, face: 'follow', animal: 'bee',
    path: (t) => {
      const a = (t * Math.PI * 2) / 7;
      return [0.5 + Math.sin(a) * 0.36, 0.45 + Math.sin(a * 2) * 0.22];
    },
  },
  { id: 'far', bg: 'window', title: 'Взгляд вдаль', text: 'Звезда близко — посмотри на неё. Теперь она **улетает вдаль** — проводи её взглядом до самого горизонта. И обратно.', sec: 24, face: 'far', animal: 'star', far: true,
    // Цикл 8 с: близко (большая) → улетает к горизонту (маленькая) → пауза → возвращается.
    path: (t) => { const k = farK(t); return [0.5, lerp(0.5, 0.33, k)]; }, scale: (t) => lerp(1, 0.12, farK(t)) },
  { id: 'blink', title: 'Поморгай', text: 'Часто-часто поморгай вместе с лицом — легко, без усилий.', sec: 12, face: 'blink', animal: null },
  { id: 'squeeze', title: 'Зажмурься', text: 'Крепко зажмурься на 3 секунды — и широко открой глаза. Повтори вместе с лицом.', sec: 18, face: 'squeeze', animal: null },
  { id: 'palms', bg: 'palms', title: 'Тёплые ладони', text: 'Потри ладони друг о друга, пока не станут тёплыми. Закрой ими глаза и спокойно подыши. Открой глаза, когда услышишь звонкий сигнал.', sec: 20, face: 'closed', animal: null, dark: true },
];
// Доля «удалённости» звезды 0 (близко) … 1 (у горизонта) в цикле 8 секунд.
function farK(t) {
  const c = t % 8;
  if (c < 1.5) return 0;
  if (c < 5) return ease((c - 1.5) / 3.5);
  if (c < 6.3) return 1;
  return 1 - ease((c - 6.3) / 1.7);
}
const TOTAL = STEPS.reduce((s, x) => s + x.sec, 0);

const rich = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

// onTick(минут до зарядки) — раз в секунду (для таймера на кнопке «Глаза»).
export function createEyes({ isBusy, art = {}, onComplete, onTick }) {
  // Заранее загружаем картинки, чтобы при моргании и смене кадров не было мигания.
  const preload = [];
  const walk = (o) => { if (typeof o === 'string') { const im = new Image(); im.src = o; preload.push(im); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
  walk(art);
  let playSec = 0;
  let nextAt = REMIND_AFTER;
  let running = null;

  const minutesLeft = () => Math.max(0, Math.ceil((nextAt - playSec) / 60));
  // Счётчик игрового времени (только когда вкладка видна). Пора, а ученик в задании или диалоге —
  // предложение появится сразу, как он освободится (кнопка «Глаза» пока мигает «пора»).
  setInterval(() => {
    if (document.visibilityState !== 'visible' || running) return;
    playSec++;
    onTick?.(minutesLeft());
    if (playSec >= nextAt && !isBusy()) offer();
  }, 1000);
  onTick?.(minutesLeft());

  function offer() {
    if (document.querySelector('.eyes-offer')) return;
    nextAt = playSec + LATER; // если окно просто закроют — напомним позже
    sound.play('ding');
    const close = () => { wrap.remove(); };
    const wrap = h('div', { class: 'overlay eyes-offer' },
      h('div', { class: 'modal eyes-offer-card' },
        makeFace(art.face).el,
        h('h2', {}, 'Пора дать глазам отдохнуть'),
        h('p', {}, 'Ты играешь уже 20 минут. Сделаем зарядку для глаз — всего 3 минуты?'),
        h('div', { class: 'modal-btns center-row' },
          h('button', { class: 'btn', onclick: () => { close(); nextAt = playSec + REMIND_AFTER; } }, 'Пропустить'),
          h('button', { class: 'btn', onclick: () => { close(); nextAt = playSec + LATER; toast('Напомню через 5 минут. Зарядка — Ctrl + E.', 'info', 3000); } }, 'Позже'),
          h('button', { class: 'btn primary', onclick: () => { close(); open(); } }, 'Начать зарядку'),
        ),
      ),
    );
    document.getElementById('ui').append(wrap);
  }

  // ---------- Сама зарядка ----------
  function open() {
    if (running) return;
    document.querySelector('.eyes-offer')?.remove();
    sound.play('open');
    const field = h('div', { class: 'eyes-field' });
    const target = h('div', { class: 'eyes-target' });
    field.append(target);
    const face = makeFace(art.face);
    const bg = h('div', { class: 'eyes-bg' });
    const title = h('div', { class: 'eyes-title' });
    const text = h('div', { class: 'eyes-text' });
    const count = h('div', { class: 'eyes-count' });
    const bar = h('i');
    const skip = h('button', { class: 'btn small' }, 'Следующее упражнение ⏭');
    const stop = h('button', { class: 'btn small' }, 'Закончить зарядку');
    const panel = h('div', { class: 'eyes-panel' },
      h('div', { class: 'eyes-head' }, h('b', {}, 'Зарядка для глаз'), count, h('div', { class: 'eyes-bar' }, bar)),
      title, text,
    );
    const wrap = h('div', { class: 'overlay eyes-wrap' },
      h('div', { class: 'eyes-stage' }, bg, field, panel, h('div', { class: 'eyes-face' }, face.el), h('div', { class: 'eyes-btns' }, skip, stop)),
    );
    document.getElementById('ui').append(wrap);

    let i = -1, t0 = 0, done = 0, raf = 0, skipped = false;
    let sprite = null;
    const st = { wrap, raf: 0 };
    running = st;

    const go = (k) => {
      i = k;
      if (i >= STEPS.length) return finish(true);
      const s = STEPS[i];
      t0 = performance.now();
      title.textContent = `${i + 1}. ${s.title}`;
      text.innerHTML = rich(s.text);
      sprite = s.animal ? makeSprite(s.animal, art) : null;
      target.replaceChildren(...(sprite ? [sprite.el] : []));
      bg.style.backgroundImage = s.bg && art[s.bg] ? `url(${art[s.bg]})` : '';
      bg.classList.toggle('on', !!(s.bg && art[s.bg]));
      target.classList.toggle('hidden', !s.animal);
      target.classList.toggle('far', !!s.far);
      wrap.classList.toggle('dark', !!s.dark);
      sound.play(i === 0 ? 'click' : 'pop');
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = STEPS[i];
      if (!s) return;
      const t = (performance.now() - t0) / 1000;
      const total = done + Math.min(t, s.sec);
      bar.style.width = (total / TOTAL) * 100 + '%';
      count.textContent = `упражнение ${i + 1} из ${STEPS.length} · осталось ${Math.max(0, Math.ceil(TOTAL - total))} с`;
      // Поле полёта — свободная область между инструкцией и лицом (зверёк не прячется за текстом).
      const stg = field.parentElement.getBoundingClientRect();
      field.style.top = Math.max(8, panel.getBoundingClientRect().bottom - stg.top + 10) + 'px';
      field.style.bottom = Math.max(8, stg.bottom - face.el.getBoundingClientRect().top + 6) + 'px';
      const fr = field.getBoundingClientRect();
      // Координаты траектории — с отступом в половину зверька, чтобы он целиком оставался в поле.
      const hw = target.offsetWidth / 2, hh = Math.min(target.offsetHeight / 2, fr.height / 2);
      const px = (x) => hw + x * Math.max(0, fr.width - 2 * hw);
      const py = (y) => hh + y * Math.max(0, fr.height - 2 * hh);
      let tx = fr.width / 2, ty = fr.height / 2;
      if (s.path) {
        const [x, y] = s.path(t);
        tx = px(x); ty = py(y);
        const flip = s.animal !== 'star' && s.path(t + 0.05)[0] < x ? -1 : 1;
        sprite?.frame(t, s);
        if (s.scale) target.style.setProperty('--fs', s.scale(t).toFixed(3));
        target.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, -50%) scaleX(${flip})`;
      }
      // Зрачки смотрят на зверька: направление и сила (0..1).
      const fb = face.el.getBoundingClientRect();
      const fx = fb.left + fb.width / 2, fy = fb.top + fb.height * 0.5;
      const ax = fr.left + tx - fx, ay = fr.top + ty - fy;
      const d = Math.hypot(ax, ay) || 1;
      const k = s.face === 'follow' || s.face === 'open' || s.face === 'far' ? Math.min(1, d / 220) : 0;
      face.look((ax / d) * k, (ay / d) * k);
      // Веки.
      if (s.face === 'blink') face.state(Math.sin(t * 9) > 0.55 ? 'closed' : 'open');
      else if (s.face === 'squeeze') face.state(t % 6 < 3 ? 'squeeze' : 'open');
      else if (s.face === 'closed') face.state('closed');
      else face.state((t % 4.2) < 0.15 ? 'closed' : 'open'); // естественное моргание
      if (t >= s.sec) {
        done += s.sec;
        if (s.id === 'palms') sound.play('ding');
        go(i + 1);
      }
    };
    const finish = (complete) => {
      cancelAnimationFrame(raf);
      wrap.remove();
      running = null;
      nextAt = playSec + REMIND_AFTER;
      onTick?.(minutesLeft());
      window.removeEventListener('keydown', onKey, true);
      if (complete && !skipped) { sound.play('star'); toast('**Глаза отдохнули!** Следующая зарядка — через 20 минут.', 'info', 4000); onComplete?.(); }
      else if (complete) toast('Зарядка закончена. Чтобы получить «Ясный взгляд», пройди её целиком — без пропусков.', 'info', 4500);
    };
    skip.onclick = () => { skipped = true; done += STEPS[i].sec; go(i + 1); };
    stop.onclick = () => finish(false);
    const onKey = (e) => {
      if (e.code === 'Escape' || (e.code === 'KeyE' && (e.ctrlKey || e.metaKey))) { e.stopPropagation(); e.preventDefault(); finish(false); }
      else if (e.code === 'Space' || e.code === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); skip.onclick(); }
      else e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true); // раньше окон под зарядкой
    go(0);
    raf = requestAnimationFrame(frame);
  }

  return {
    open,
    get running() { return !!running; },
    // Сохранение для «Продолжить»: сколько уже играли и когда следующая зарядка.
    save: () => ({ playSec, nextAt }),
    load(s) { if (s) { playSec = s.playSec || 0; nextAt = s.nextAt || REMIND_AFTER; onTick?.(minutesLeft()); } },
  };
}

// Лицо с большими красивыми глазами (зрачки .pupil-l/.pupil-r, веки .lid).
export function faceSvg() {
  const d = document.createElement('div');
  d.className = 'eyes-face-svg';
  d.innerHTML = `<svg viewBox="0 0 240 200">
    <defs><radialGradient id="eyIris" cx="40%" cy="38%" r="65%"><stop offset="0" stop-color="#6fc6ff"/><stop offset=".6" stop-color="#2f7fe0"/><stop offset="1" stop-color="#1d3f8a"/></radialGradient></defs>
    <circle cx="120" cy="104" r="92" fill="#ffd9b8"/>
    <ellipse cx="54" cy="128" rx="16" ry="10" fill="#ff9e9e" opacity=".55"/><ellipse cx="186" cy="128" rx="16" ry="10" fill="#ff9e9e" opacity=".55"/>
    <path d="M58 52 Q80 38 102 50" stroke="#6b4226" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M138 50 Q160 38 182 52" stroke="#6b4226" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${[80, 160].map((cx, k) => `
      <g>
        <ellipse cx="${cx}" cy="92" rx="30" ry="34" fill="#fff" stroke="#30344a" stroke-width="3"/>
        <g class="${k ? 'pupil-r' : 'pupil-l'}"><circle cx="${cx}" cy="94" r="17" fill="url(#eyIris)"/><circle cx="${cx}" cy="94" r="8" fill="#14142a"/>
          <circle cx="${cx - 6}" cy="86" r="5" fill="#fff"/><circle cx="${cx + 6}" cy="101" r="2.4" fill="#fff" opacity=".8"/></g>
        <g class="lid" style="transform-origin:${cx}px 58px;transform:scaleY(0)"><ellipse cx="${cx}" cy="92" rx="35" ry="39" fill="#ffd9b8"/><path d="M${cx - 30} 126 Q${cx} 140 ${cx + 30} 126" stroke="#30344a" stroke-width="3" fill="none" stroke-linecap="round"/></g>
        <path d="M${cx - 26} 66 l-8 -10 M${cx - 10} 59 l-3 -12 M${cx + 10} 59 l3 -12 M${cx + 26} 66 l8 -10" stroke="#30344a" stroke-width="3" stroke-linecap="round"/>
      </g>`).join('')}
    <path d="M100 150 Q120 166 140 150" stroke="#c0505a" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`;
  return d;
}

// Лицо: картинки Совёнка (открытые пустые белки + 2 радужки поверх; закрытые; зажмуренные)
// или запасное SVG-лицо. Возвращает { el, look(dx, dy) (−1..1), state('open'|'closed'|'squeeze') }.
function makeFace(f) {
  if (!f?.open) {
    const el = faceSvg();
    const L = el.querySelector('.pupil-l'), R = el.querySelector('.pupil-r');
    const lids = el.querySelectorAll('.lid');
    return {
      el,
      look(dx, dy) { for (const p of [L, R]) p.setAttribute('transform', `translate(${dx * 7} ${dy * 7})`); },
      state(s) { lids.forEach((l) => { l.style.transform = `scaleY(${s === 'open' ? 0 : 1})`; }); },
    };
  }
  const size = (f.irisSize ?? 0.2128) * 100;
  const base = h('img', { class: 'owl-base', src: f.open, alt: '' });
  const irises = f.eyes.map(() => h('img', { class: 'owl-iris', src: f.iris, alt: '' }));
  const el = h('div', { class: 'owl-face' }, base, ...irises);
  let cur = 'open';
  const [mx, my] = f.move || [0.0239, 0.0319];
  const face = {
    el,
    look(dx, dy) {
      // Зрачок ходит внутри эллипса допустимого хода — не вылезает за белок.
      const r = Math.hypot(dx, dy);
      if (r > 1) { dx /= r; dy /= r; }
      f.eyes.forEach(([cx, cy], k) => {
        irises[k].style.width = size + '%';
        irises[k].style.left = (cx + dx * mx) * 100 - size / 2 + '%';
        irises[k].style.top = (cy + dy * my) * 100 - (f.irisAnchorY ?? 0.5044) * size + '%';
      });
    },
    state(s) {
      if (s === cur) return;
      cur = s;
      base.src = s === 'closed' ? f.closed || f.open : s === 'squeeze' ? f.squeeze || f.closed || f.open : f.open;
      irises.forEach((im) => { im.style.visibility = s === 'open' ? '' : 'hidden'; });
    },
  };
  face.look(0, 0); // зрачки сразу на месте (в окне-предложении лицо ни на кого не смотрит)
  return face;
}

// Зверёк: картинка (1–2 кадра) или SVG. Кадры НЕ переключаются резко (это мигание и дискомфорт
// для глаз): второй кадр плавно проступает поверх первого, медленно; бабочка мягко машет крыльями.
function makeSprite(animal, art) {
  const frames = Array.isArray(art[animal]) ? art[animal] : art[animal] ? [art[animal]] : null;
  if (!frames) {
    const el = h('div', { class: 'eyes-svg', html: ANIMALS[animal] });
    return { el, frame() {} };
  }
  const a = h('img', { src: frames[0], alt: '', draggable: 'false' });
  const b = frames[1] && animal !== 'butterfly' ? h('img', { class: 'eyes-frame2', src: frames[1], alt: '', draggable: 'false' }) : null;
  const el = h('div', { class: 'eyes-sprite' }, a, b);
  const smooth = (k) => k * k * (3 - 2 * k);
  return {
    el,
    frame(t) {
      if (animal === 'butterfly') {
        // Парит: без масштабирования — лёгкое покачивание вверх-вниз и плавный наклон.
        a.style.transform = `translateY(${(Math.sin(t * 2.2) * 6).toFixed(1)}px) rotate(${(Math.sin(t * 1.3) * 7).toFixed(1)}deg)`;
        return;
      }
      if (!b) return;
      let w;
      if (animal === 'frog') {
        // Позы сильно разные — без наложения (иначе «раздвоение»): в воздухе — прыжок, на земле — сидит.
        const k = (t % 1.2) / 1.2;
        w = Math.sin(Math.PI * k) > 0.3 ? 1 : 0;
      } else if (animal === 'dog') {
        // Кадры бега почти одинаковы (меняются лапы) — спокойная смена ~3 раза в секунду, без наложения.
        w = Math.floor(t / 0.42) % 2;
      } else {
        // Пчёлка: меняются только полупрозрачные крылья — мягкое перетекание.
        w = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2.5);
      }
      // Первый кадр гаснет, когда виден второй, — две позы никогда не видны одновременно целиком.
      if (animal !== 'bee') a.style.opacity = String(1 - w);
      b.style.opacity = w.toFixed(3);
    },
  };
}
