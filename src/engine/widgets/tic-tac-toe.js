// tic-tac-toe — партия против ИИ (минимакс: он просчитывает все ходы, лучше ничьей не выйдет).
// Потом кнопки «Позови ИИ…» показывают: каждая программа учится одной игре.
// data: { intro, asks: [{ label, reply }], conclusion, next? }
import { h, rich, fmt } from '../util.js';
import { feedback, wait } from './kit.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = (b) => {
  for (const [a, c, e] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[e]) return b[a];
  return b.every(Boolean) ? 'draw' : null;
};
function minimax(b, me) {
  const w = winner(b);
  if (w === 'O') return { s: 10 };
  if (w === 'X') return { s: -10 };
  if (w === 'draw') return { s: 0 };
  let best = { s: me === 'O' ? -99 : 99 };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = me;
    const r = minimax(b, me === 'O' ? 'X' : 'O');
    b[i] = null;
    const s = r.s - Math.sign(r.s) * 0.1; // быстрее выиграть / позже проиграть
    if (me === 'O' ? s > best.s : s < best.s) best = { s, i };
  }
  return best;
}

export default function ticTacToe(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const board = Array(9).fill(null);
  const status = h('div', { class: 'ttt-status' }, 'Ты — крестики, ходи первым!');
  const asks = h('div', { class: 'hidden' });
  let lock = false;
  const cells = board.map((_, i) => {
    const c = h('button', { class: 'ttt-cell' });
    c.onclick = () => move(i);
    return c;
  });
  // Крестик и нолик рисуем SVG (символы шрифта обрезались и зависели от шрифта).
  const MARK = {
    X: '<svg viewBox="0 0 40 40"><path d="M9 9 31 31M31 9 9 31" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/></svg>',
    O: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="12" fill="none" stroke="#e5484d" stroke-width="6"/></svg>',
  };
  const draw = () => cells.forEach((c, i) => { c.innerHTML = MARK[board[i]] || ''; c.className = 'ttt-cell ' + (board[i] || ''); });

  async function move(i) {
    if (lock || board[i] || winner(board)) return;
    board[i] = 'X';
    api.sound.play('pop');
    draw();
    if (await end()) return;
    lock = true;
    status.textContent = 'ИИ проверяет все возможные ходы…';
    await wait(650);
    board[minimax(board, 'O').i] = 'O';
    api.sound.play('click');
    draw();
    lock = false;
    if (!(await end())) status.textContent = 'Твой ход!';
  }

  async function end() {
    const w = winner(board);
    if (!w) return false;
    lock = true;
    status.textContent = fmt(w === 'draw' ? 'Ничья! Лучше у ИИ выиграть нельзя — он просчитал все ходы.' : w === 'O' ? 'ИИ выиграл: он просчитал все ходы наперёд.' : 'Ты {выиграл|выиграла}! Так почти не бывает.');
    api.sound.play(w === 'draw' ? 'good' : 'pop');
    await wait(500);
    showAsks();
    return true;
  }

  const showAsks = () => {
    const used = new Set();
    asks.replaceChildren(h('h3', { class: 'w-q' }, 'А теперь позови ИИ в другую игру:'),
      h('div', { class: 'opts row' }, d.asks.map((a, k) => {
        const b = h('button', { class: 'chip big' }, a.label);
        b.onclick = () => {
          b.disabled = true;
          used.add(k);
          asks.append(h('div', { class: 'msg bot' }, h('span', { class: 'chat-ava letter' }, 'И'), h('div', { class: 'bubble' }, h('div', { class: 'msg-text', html: rich(a.reply) }))));
          api.sound.play('beep');
          if (used.size === d.asks.length) { fb.ok(d.conclusion); next.classList.remove('hidden'); }
        };
        return b;
      })));
    asks.classList.remove('hidden');
  };

  el.append(h('div', { class: 'w-two' },
    h('div', { class: 'ttt' }, ...cells),
    h('div', { class: 'w-col' }, d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }), status, asks, fb.el, h('div', { class: 'w-actions' }, next)),
  ));
}
