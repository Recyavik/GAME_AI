// HUD: карточка этапа, счётчики, кнопки, метка цели, значки «?/!», подписи NPC.
import * as THREE from 'three';
import { h, rich, clamp } from './util.js';
import { bump } from './modal.js';

const v = new THREE.Vector3();

export class Hud {
  constructor({ camera, progress, actions, scenario }) {
    this.camera = camera;
    this.progress = progress;
    this.ui = document.getElementById('ui');
    this.root = h('div', { class: 'hud hidden' });
    this.ui.append(this.root);

    // Карточка этапа.
    this.card = h('div', { class: 'stage-card', title: 'Список станций (Q)', onclick: () => actions.stations?.() });
    // Счётчики: карточки правды, щиты, листовки-слухи, очки.
    this.cCards = h('b');
    this.cShields = h('b');
    this.cRumors = h('b');
    this.cScore = h('b');
    this.counters = h('div', { class: 'counters' },
      h('div', { class: 'counter click', title: 'Карточки правды', onclick: () => actions.notebook('cards') }, h('span', { class: 'ci card-ci' }, '▤'), this.cCards),
      h('div', { class: 'counter click', title: 'Щиты безопасности', onclick: () => actions.notebook('shields') }, h('span', { class: 'ci shield-ci' }, shieldIcon()), this.cShields),
      h('div', { class: 'counter', title: 'Проверенные листовки Гоши' }, h('span', { class: 'ci spot-ci' }, scenario.meta.spotMark || '?'), this.cRumors),
      h('div', { class: 'counter score', title: 'Очки' }, h('span', { class: 'ci' }, 'Очки'), this.cScore),
    );
    // Пропуск (появляется после оформления на станции «Лица»).
    this.badge = h('div', { class: 'hud-badge hidden' });
    // Кнопки.
    const btn = (icon, text, key, fn, cls = '') =>
      h('button', { class: 'tbtn ' + cls, onclick: fn, title: `${text} (${key})` }, h('span', { class: 'ti' }, icon), h('span', { class: 'tt' }, text), h('kbd', {}, key));
    this.autoBtn = btn('➜', 'Идти к цели', 'G', actions.auto, 'go');
    this.soundBtn = btn('♪', 'Звук', 'M', actions.sound);
    // Справа внизу: одна панель-«док» со второстепенными кнопками и под ней главная — «Идти к цели».
    this.toolbar = h('div', { class: 'toolbar' },
      h('div', { class: 'dock' },
        btn('☰', 'Станции', 'Q', () => actions.stations?.()),
        btn('▤', 'Блокнот', 'B', () => actions.notebook()),
        h('i', { class: 'dock-sep' }),
        this.soundBtn,
        btn('⛶', 'Экран', 'F', actions.fullscreen),
        h('button', { class: 'tbtn eyes-tbtn', onclick: () => actions.eyes?.(), title: 'Зарядка для глаз (Ctrl + E)', html: '<span class="ti"><svg viewBox="0 0 32 16" width="26" height="14"><ellipse cx="8" cy="8" rx="7" ry="6.5" fill="#fff" stroke="#30344a" stroke-width="1.6"/><ellipse cx="24" cy="8" rx="7" ry="6.5" fill="#fff" stroke="#30344a" stroke-width="1.6"/><circle cx="9" cy="8.5" r="3.4" fill="#2f7fe0"/><circle cx="25" cy="8.5" r="3.4" fill="#2f7fe0"/><circle cx="8" cy="7.2" r="1.1" fill="#fff"/><circle cx="24" cy="7.2" r="1.1" fill="#fff"/></svg><b class="eyes-min" title="Минут до зарядки для глаз"></b></span><span class="tt">Глаза</span><kbd>Ctrl E</kbd>' }),
      ),
      this.autoBtn,
    );
    this.helpLine = h('div', { class: 'help-line' }, 'Клик или WASD — идти · G — к цели · колесо — зум · зажми колесо и веди — поворот · Esc — закрыть окно');

    // Метка цели.
    this.goalEl = h('div', { class: 'goal-marker hidden' }, h('span', { class: 'gm-arrow' }, '▼'), h('span', { class: 'gm-text' }));
    this.badges = h('div', { class: 'badges' });
    this.labels = h('div', { class: 'labels' });
    this.pinsEl = h('div', { class: 'pins' });
    this.pins = [];
    this.root.append(this.pinsEl, this.labels, this.badges, this.goalEl, this.card, this.counters, this.badge, this.toolbar, this.helpLine);

    this.goal = null;
    this.spotEls = new Map();
    this.npcEls = new Map();
    this.refresh();
  }

  show(on = true) { this.root.classList.toggle('hidden', !on); }

  // Карточка цели: что делать сейчас и сколько станций выполнено.
  setTarget(stage, done, total, task, started) {
    const pct = Math.round((done / total) * 100);
    this.card.replaceChildren(
      h('div', { class: 'sc-top' }, h('span', {}, `Выполнено ${done} из ${total}`), h('span', { class: 'sc-title' }, stage ? stage.title : 'Всё готово!')),
      h('div', { class: 'sc-bar' }, h('i', { style: { width: pct + '%' } })),
      h('div', { class: 'sc-task', html: (started ? '<span class="sc-started">продолжить</span> ' : '') + rich(task || '') }),
      h('div', { class: 'sc-hint' }, 'Сменить цель — Q'),
    );
    bump(this.card);
  }

  // Номера доступных станций над их точками: [{ pos, text, locked, started }].
  setPins(list) {
    this.pinsEl.replaceChildren();
    this.pins = list.map((p) => {
      const el = h('div', { class: 'pin' + (p.locked ? ' locked' : '') + (p.started ? ' started' : ''), html: p.locked ? LOCK : '' }, p.locked ? null : p.text);
      this.pinsEl.append(el);
      return { ...p, el };
    });
  }

  refresh(what) {
    const p = this.progress;
    this.cCards.textContent = `${p.cards.size}/${p.cardsTotal}`;
    this.cShields.textContent = `${p.shields.size}/${p.shieldsTotal}`;
    this.cRumors.textContent = `${p.rumorsDone}/${p.rumorsTotal}`;
    this.cScore.textContent = String(p.score);
    const map = { card: this.cCards, shield: this.cShields, rumor: this.cRumors };
    if (map[what]) bump(map[what].parentElement);
    if (what && what !== 'fact' && what !== 'ach') bump(this.cScore.parentElement);
  }

  // Документы героя в углу экрана (пропуск, читательский билет…): card = { title, sub, noPhoto }.
  // noPhoto — герой отказался от фото: вместо лица знак «?».
  showBadge(hero, card) {
    card = { title: 'Пропуск', sub: 'Корреспондент фестиваля', ...card };
    if ([...this.badge.children].some((c) => c.dataset.t === card.title)) return;
    (this.docs ||= []).push(card); // для сохранения
    const pic = card.noPhoto ? h('span', { class: 'nophoto' }, '?') : h('img', { src: hero.portrait, alt: '' });
    const el = h('div', { class: 'hud-doc', 'data-t': card.title }, pic, h('div', {}, h('b', {}, card.title), h('span', {}, card.sub)));
    this.badge.append(el);
    this.badge.classList.remove('hidden');
    bump(el);
  }

  setSound(on) { this.soundBtn.classList.toggle('off', !on); }

  // Минут до зарядки для глаз (на кнопке «Глаза»); 0 — «пора» и кнопка мигает.
  setEyesTimer(min) {
    const el = this.toolbar.querySelector('.eyes-min');
    const text = min > 0 ? `${min} мин` : 'пора';
    if (el.textContent !== text) el.textContent = text;
    el.closest('.tbtn').classList.toggle('due', min <= 0);
  }

  // Цель: { pos: Vector3, label }
  setGoal(goal) {
    this.goal = goal;
    this.goalEl.classList.toggle('hidden', !goal);
    if (goal) this.goalEl.querySelector('.gm-text').textContent = goal.label || 'Цель';
    this.autoBtn.disabled = !goal;
  }

  addSpot(id, pos, mark, onClick) {
    const el = h('button', { class: 'spot-badge hidden', onclick: onClick, title: 'Вопрос' }, mark);
    this.badges.append(el);
    this.spotEls.set(id, { el, pos });
  }
  markSpot(id, done) { this.spotEls.get(id)?.el.classList.toggle('done', done); }

  addLabel(id, name, obj) {
    const el = h('div', { class: 'npc-label hidden' }, name);
    this.labels.append(el);
    this.npcEls.set(id, { el, obj });
  }

  _project(pos) {
    v.copy(pos).project(this.camera);
    const behind = v.z > 1;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind };
  }

  update(playerPos, locked) {
    this.helpLine.classList.toggle('hidden', locked);
    // Метка цели: над объектом; если за краем экрана — прижимается к краю.
    if (this.goal) {
      const p = this._project(this.goal.pos);
      const m = 60;
      let { x, y } = p;
      if (p.behind) { x = innerWidth - x; y = innerHeight - m; }
      const off = p.behind || x < m || x > innerWidth - m || y < m || y > innerHeight - m;
      const hw = Math.max(m, this.goalEl.offsetWidth / 2 + 12); // метка не уходит за край экрана
      x = clamp(x, hw, innerWidth - hw);
      y = clamp(y, m + 40, innerHeight - m - 40);
      this.goalEl.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      this.goalEl.classList.toggle('edge', off);
      const arrow = this.goalEl.querySelector('.gm-arrow');
      if (off) {
        const ang = Math.atan2(p.y - innerHeight / 2, p.x - innerWidth / 2) * (p.behind ? -1 : 1);
        arrow.style.transform = `rotate(${ang - Math.PI / 2}rad)`;
      } else arrow.style.transform = '';
    }
    // Номера станций — видны всегда, если на экране.
    for (const p of this.pins) {
      const q = this._project(p.pos);
      const vis = !locked && !q.behind && q.x > 0 && q.x < innerWidth && q.y > 0 && q.y < innerHeight;
      p.el.classList.toggle('hidden', !vis);
      if (vis) p.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
    }
    // Значки — видны в радиусе 7 м.
    for (const [, s] of this.spotEls) {
      const d = Math.hypot(s.pos.x - playerPos.x, s.pos.z - playerPos.z);
      const vis = d < 7 && !locked;
      s.el.classList.toggle('hidden', !vis);
      if (vis) {
        const p = this._project(s.pos);
        s.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      }
    }
    // Подписи NPC — в радиусе 6 м.
    for (const [, n] of this.npcEls) {
      v.copy(n.obj.position);
      v.y += n.obj.userData.height + 0.25;
      const d = Math.hypot(n.obj.position.x - playerPos.x, n.obj.position.z - playerPos.z);
      const vis = n.obj.visible && d < 6 && !locked;
      n.el.classList.toggle('hidden', !vis);
      if (vis) {
        const p = this._project(v);
        n.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }
    }
  }
}

function shieldIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', '18');
  s.setAttribute('height', '18');
  s.innerHTML = '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="#2563eb"/>';
  return s;
}

// Значок замка (эмодзи на старых Windows не отображаются).
const LOCK = '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
