// Стартовая страница: счётчик «В игру сыграли», паспорта героев, появление блоков при прокрутке.
import { HEROES } from './heroes.js';

// ---------- счётчик ----------
// Каждое открытие страницы — +1 (так решено: считаем все посещения, даже повторные).
// Без сервера (страница открыта файлом) счётчик просто не показывается.
const word = (n) => {
  const a = n % 10, b = n % 100;
  return a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'раза' : 'раз';
};
async function counter() {
  if (location.protocol === 'file:') return;
  try {
    const r = await fetch('/api/visit', { method: 'POST' });
    if (!r.ok) return;
    const { count } = await r.json();
    const box = document.getElementById('counter');
    const num = document.getElementById('counter-num');
    document.getElementById('counter-word').textContent = word(count);
    box.classList.remove('hidden');
    const fmt = new Intl.NumberFormat('ru-RU');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || count < 10) { num.textContent = fmt.format(count); return; }
    // Плавный «набег» числа.
    const t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      num.textContent = fmt.format(Math.round(count * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } catch { /* нет сервера — без счётчика */ }
}

// ---------- герои ----------
function renderHeroes(filter = 'all') {
  const box = document.getElementById('cards');
  const tpl = document.getElementById('card-tpl');
  box.replaceChildren();
  HEROES.filter((h) => filter === 'all' || h.group === filter).forEach((h, i) => {
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.style.setProperty('--c', h.color);
    el.style.animationDelay = `${i * 40}ms`;
    const img = el.querySelector('.portrait img');
    img.src = h.img;
    img.alt = h.name;
    el.querySelector('.name').textContent = h.name;
    el.querySelector('.role').textContent = h.role;
    for (const [cls, key] of [['f-name', 'name'], ['f-age', 'age'], ['f-where', 'where'], ['f-does', 'does'], ['f-hobby', 'hobby'], ['f-quote', 'quote']]) {
      el.querySelector('.' + cls).textContent = h[key];
    }
    const btn = el.querySelector('.card-in');
    btn.setAttribute('aria-label', `${h.name} — ${h.role}. Открыть паспорт`);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(open));
      btn.setAttribute('aria-label', `${h.name}. ${open ? 'Паспорт открыт, нажмите, чтобы перевернуть' : 'Открыть паспорт'}`);
    });
    box.append(el);
  });
}
function filters() {
  const tabs = document.querySelectorAll('.filters button');
  tabs.forEach((b) => b.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderHeroes(b.dataset.f);
  }));
}

// ---------- появление при прокрутке ----------
function reveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('seen')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}

document.getElementById('year').textContent = String(new Date().getFullYear());
renderHeroes();
filters();
reveal();
counter();
