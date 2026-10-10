// Титульный экран: плашка занятия, завязка, выбор героя, управление, кнопки.
// saved — краткая сводка сохранённой игры { hero, done, total, score } или null.
// Возвращает Promise<{ hero, resume }>: resume = true — «Продолжить», иначе новая игра.
import { h, rich } from './util.js';
import { sound } from './sound.js';

export function showTitle(sc, saved = null) {
  const m = sc.meta;
  const heroes = sc.heroes;
  let hero = heroes[0];
  return new Promise((resolve) => {
    const heroBtns = heroes.map((hr) => {
      const b = h('button', { class: 'hero-btn' + (hr === hero ? ' on' : '') },
        h('img', { src: hr.portrait, alt: '' }),
        h('span', {}, hr.name),
      );
      b.onclick = () => {
        hero = hr;
        heroBtns.forEach((x) => x.classList.toggle('on', x === b));
        sound.play('click');
      };
      return b;
    });
    const go = (resume = false) => {
      sound.unlock();
      sound.play('whoosh');
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
      resolve({ hero: resume ? saved.hero : hero, resume });
    };
    // Есть сохранённая игра — предлагаем продолжить с того же места.
    const cont = saved && h('div', { class: 'title-continue' },
      h('img', { src: saved.hero.portrait, alt: '' }),
      h('div', {}, h('b', {}, `Сохранённая игра: ${saved.hero.name}`), h('span', {}, `Выполнено ${saved.done} из ${saved.total} · очки ${saved.score}`)),
      h('button', { class: 'btn primary', onclick: () => go(true) }, 'Продолжить ▶'),
    );
    const el = h('div', { class: 'title-screen' },
      h('div', { class: 'title-card' },
        m.logo && h('img', { class: 'title-logo', src: m.logo, alt: '' }),
        h('div', { class: 'plaque' }, m.subtitle),
        h('h1', { html: rich(m.title) }),
        cont,
        h('p', { class: 'title-intro', html: rich(m.intro) }),
        heroes.length > 1 && h('div', { class: 'hero-pick' }, h('div', { class: 'hp-label' }, 'Выбери героя'), h('div', { class: 'hp-row' }, heroBtns)),
        h('div', { class: 'keys' },
          key('Клик / WASD', 'идти'),
          key('Пробел', 'дальше'),
          key('G', 'к цели'),
          key('F', 'весь экран'),
          key('Ctrl + E', 'зарядка для глаз'),
          key('Колесо', 'зум'),
          key('Esc', 'закрыть окно'),
        ),
        h('div', { class: 'title-btns' },
          h('button', { class: 'btn big' + (saved ? '' : ' primary'), onclick: () => go(false) }, saved ? 'Начать сначала' : 'Начать ▶'),
          h('button', { class: 'btn', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()) }, '⛶ На весь экран'),
        ),
        h('div', { class: 'title-note' }, 'На интерактивной доске включите полный экран (F). Игра работает без интернета.'),
      ),
    );
    document.getElementById('ui').append(el);
  });
}

const key = (k, t) => h('div', { class: 'key' }, h('kbd', {}, k), h('span', {}, t));
