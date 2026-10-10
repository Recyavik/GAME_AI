// Мелкие помощники: DOM, тексты, математика.

// Создать элемент: h('div', { class: 'x', onclick: fn }, 'текст', детиУзлы…)
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

// Подстановки в текстах сценария:
//   {name} / {Имя}    — имя героя;
//   {прошёл|прошла}   — форма по полу героя (м|ж);
//   {а}               — «а» для героини, пусто для героя («сам{а}», «проверил{а}»);
//   **жирный**        — выделение.
let hero = { name: '', female: false };
export function setHero(h) { hero = h; }
export const heroFemale = () => !!hero.female;
export function fmt(text) {
  return String(text ?? '')
    .replace(/\{name\}|\{Имя\}/g, hero.name)
    .replace(/\{а\}/g, hero.female ? 'а' : '')
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (hero.female ? f : m));
}
export function rich(text) {
  return esc(fmt(text)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

// Перемешать копию массива.
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

