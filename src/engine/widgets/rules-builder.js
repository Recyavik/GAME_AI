// rules-builder — «Памятка безопасного общения с ИИ»: перенести в памятку настоящие щиты,
// отбросить ложные (Гоша их «подкладывает»). В конце — «печать» и сохранение PNG (без сети).
// data: { intro, title, fakes: [{ text, why }], done, next? }. Пункты — из sc.memo.lines (тот же текст, что в финале).
import { h, rich, shuffle, fmt } from '../util.js';
import { feedback, wait } from './kit.js';
import { shieldSvg } from '../stations.js';

export default function rulesBuilder(el, d, api) {
  const lines = api.ctx.progress?.sc.memo?.lines || {};
  const progress = api.ctx.progress;
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const shields = progress.sc.shields;
  const memo = h('ol', { class: 'rb-memo' }, shields.map(() => h('li', { class: 'empty' }, '…')));
  let filled = 0;

  const items = shuffle([
    // Все карточки выглядят одинаково (одна иконка, правило одной длины) — иначе ложные видно сразу.
    ...shields.map((s) => ({ real: true, s, text: s.rule })),
    ...d.fakes.map((f) => ({ real: false, f, text: f.text })),
  ]);
  const pile = h('div', { class: 'rb-pile' }, items.map((it) => {
    const b = h('button', { class: 'rb-item' },
      h('span', { class: 'rb-shield' }, shieldSvg()),
      h('span', { html: rich(it.text) }),
    );
    b.onclick = () => {
      if (b.disabled) return;
      if (it.real) {
        b.disabled = true;
        b.classList.add('used');
        const li = memo.children[shields.indexOf(it.s)];
        li.className = '';
        li.innerHTML = rich(lines[it.s.id] || it.s.rule);
        filled++;
        api.sound.play('good');
        b.classList.add('ok');
        fb.ok(`Щит «${it.s.title}» — в памятку!`);
        if (filled === shields.length) print();
      } else {
        api.mistake();
        api.sound.play('bad');
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        b.disabled = true;
        b.classList.add('fake-found');
        fb.warn('это ложный щит: ' + it.f.why);
      }
    };
    return b;
  }));

  const sheet = h('div', { class: 'rb-sheet' }, h('h3', {}, d.title), memo, h('div', { class: 'stamp small hidden' }, 'ПРОВЕРЕНО'));
  const print = async () => {
    pile.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    sheet.classList.add('printing');
    api.sound.play('whoosh');
    await wait(900);
    sheet.classList.remove('printing');
    sheet.querySelector('.stamp').classList.remove('hidden');
    api.sound.play('star');
    fb.ok(d.done);
    const save = h('button', { class: 'btn', onclick: () => saveMemoPng(d.title, shields.map((s) => lines[s.id] || s.rule)) }, 'Сохранить памятку (PNG)');
    next.classList.remove('hidden');
    next.parentElement.prepend(save);
  };

  fb.info('Нажимай на щиты, чтобы перенести их в памятку. Осторожно: Гоша подложил ложные!');
  el.append(h('div', { class: 'w-two' },
    h('div', { class: 'w-col' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), pile, fb.el),
    h('div', { class: 'w-col' }, sheet, h('div', { class: 'w-actions' }, next)),
  ));
}

// Нарисовать памятку на canvas и скачать PNG (работает офлайн, двойным кликом).
export function saveMemoPng(title, lines) {
  const W = 1240, H = 1754; // A4 при 150 dpi
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf5'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2563eb'; g.fillRect(0, 0, W, 40);
  g.fillStyle = '#1f2340';
  g.font = '700 64px Unbounded, sans-serif';
  wrap(g, title, 90, 170, W - 180, 80);
  g.font = '500 40px "Golos Text", sans-serif';
  let y = 380;
  lines.forEach((l, i) => {
    g.fillStyle = '#2563eb';
    g.beginPath(); g.arc(120, y - 14, 34, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '700 36px Unbounded, sans-serif'; g.textAlign = 'center';
    g.fillText(String(i + 1), 120, y);
    g.textAlign = 'left'; g.fillStyle = '#1f2340'; g.font = '500 40px "Golos Text", sans-serif';
    y = wrap(g, fmt(l).replace(/\*\*/g, ''), 180, y, W - 270, 54) + 70;
  });
  // Штамп «ПРОВЕРЕНО»: рамка по ширине слова, целиком внутри листа (отступ 90 от края, как у текста).
  g.save();
  g.font = '700 52px Unbounded, sans-serif';
  const sw = g.measureText('ПРОВЕРЕНО').width + 60, sh = 100;
  g.translate(W - 90 - sw / 2, H - 230); g.rotate(-0.12);
  g.strokeStyle = '#e5484d'; g.lineWidth = 10; g.strokeRect(-sw / 2, -sh / 2, sw, sh);
  g.fillStyle = '#e5484d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ПРОВЕРЕНО', 0, 4);
  g.restore();
  g.fillStyle = '#64688a'; g.font = '400 30px "Golos Text", sans-serif';
  g.fillText('Совет даёт ИИ — решает человек.', 90, H - 90);
  const a = document.createElement('a');
  a.download = 'pamyatka-ii.png';
  a.href = c.toDataURL('image/png');
  document.body.append(a);
  a.click();
  a.remove();
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = t;
  }
  g.fillText(line, x, y);
  return y;
}
