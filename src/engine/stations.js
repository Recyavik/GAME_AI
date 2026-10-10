// Станция: окно поверх сцены с одним или несколькими шагами-виджетами.
//
// station = {
//   title: 'Станция 1 · Лица',
//   kind: 'how' | 'protect' | 'extra',   // how/protect — индикатор «① Как работает → ② Как защититься»
//   steps: [{ widget, data }, …]  (или widget + data),
//   shield: 's_photo',                    // для protect: в конце — карточка правила «Взять щит»
// }
// Возвращает Promise<{ result: 'done' | 'exit', mistakes }>.
// Виджет получает api: { done(), mistake(), sound, ctx } — ctx общий для игры (progress, hero, state…).
import { h, rich } from './util.js';
import { modal } from './modal.js';
import { sound } from './sound.js';
import { WIDGETS } from './widgets/index.js';

export function runStation(station, ctx = {}) {
  const steps = station.steps || [{ widget: station.widget, data: station.data }];
  const kind = station.kind || 'extra';
  return new Promise((resolve) => {
    let idx = 0;
    let mistakes = 0;
    let cleanup = null;
    const body = h('div', { class: 'st-body' });
    const stepEl = h('div', { class: 'st-step' });
    const closeBtn = h('button', { class: 'st-close', title: 'Закрыть (Esc)' }, '✕');
    const phases = kind === 'extra' ? null : h('div', { class: 'st-phases' },
      h('span', { class: kind === 'how' ? 'on' : 'done' }, '① Как работает'),
      h('i', {}, '→'),
      h('span', { class: kind === 'protect' ? 'on protect' : '' }, '② Как защититься'),
    );
    const panel = h('div', { class: 'station ' + kind },
      h('div', { class: 'st-head' },
        kind === 'protect' && h('span', { class: 'st-shield' }, shieldSvg()),
        h('div', { class: 'st-title', html: rich(station.title || 'Задание') }),
        phases,
        stepEl,
        closeBtn,
      ),
      body,
    );
    const wrap = h('div', { class: 'overlay station-wrap' }, panel);
    document.getElementById('ui').append(wrap);
    sound.play('whoosh');

    const finish = (result) => {
      cleanup?.();
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 200);
      resolve({ result, mistakes });
    };

    const show = () => {
      cleanup?.();
      cleanup = null;
      const s = steps[idx];
      stepEl.textContent = steps.length > 1 ? `шаг ${idx + 1} из ${steps.length}` : '';
      body.replaceChildren();
      body.scrollTop = 0;
      const w = WIDGETS[s.widget];
      if (!w) {
        body.append(h('p', {}, `Нет виджета «${s.widget}»`));
        return;
      }
      const api = {
        sound,
        ctx,
        mistake: () => { mistakes++; },
        done: () => {
          idx++;
          if (idx < steps.length) show();
          else if (station.shield) ruleCard();
          else finish('done');
        },
      };
      cleanup = w(body, s.data, api) || null;
    };

    // Карточка правила щита: крупно правило + «почему» + «Взять щит».
    const ruleCard = () => {
      cleanup?.();
      cleanup = null;
      closeBtn.disabled = true;
      stepEl.textContent = '';
      const s = ctx.progress?.shield(station.shield) || {};
      const pts = mistakes === 0 ? 2 : 1;
      body.replaceChildren(
        h('div', { class: 'rule-card' },
          s.icon ? h('img', { class: 'rule-icon', src: s.icon, alt: '' }) : h('span', { class: 'rule-icon' }, shieldSvg()),
          h('div', { class: 'rule-kicker' }, `Щит · ${s.title || ''}`),
          h('div', { class: 'rule-text', html: rich(s.ruleFull || s.rule || '') }),
          s.why && h('div', { class: 'rule-why', html: '<b>Почему:</b> ' + rich(s.why) }),
          h('div', { class: 'rule-pts' }, pts === 2 ? 'Без ошибок — 2 очка' : 'Были ошибки — 1 очко. Щит всё равно твой!'),
          h('button', { class: 'btn primary big shield-btn', onclick: () => { ctx.progress?.giveShield(station.shield, pts); finish('done'); } }, 'Взять щит'),
        ),
      );
      sound.play('ding');
    };

    let asking = false;
    const askExit = async () => {
      if (closeBtn.disabled || asking) return;
      asking = true;
      const v = await modal({
        title: 'Выйти из задания?',
        body: 'Задание ещё не закончено. Вернуться к нему можно, подойдя сюда снова.',
        buttons: [{ text: 'Продолжить задание', value: false, primary: true }, { text: 'Выйти', value: true }],
      });
      asking = false;
      if (v) finish('exit');
    };
    closeBtn.onclick = askExit;
    const onKey = (e) => {
      if (e.code === 'Escape' && !document.querySelector('.overlay:not(.station-wrap)')) {
        e.stopPropagation();
        askExit();
      }
    };
    document.addEventListener('keydown', onKey, true);
    show();
  });
}

export function shieldSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.innerHTML = '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="currentColor"/><path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  return s;
}
