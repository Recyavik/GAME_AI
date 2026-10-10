// Прогресс игрока: карточки правды, щиты безопасности, листовки-слухи, факты,
// достижения, очки, звания и «Блокнот корреспондента».
//
// Очки: карточка = 2; щит = 2 (с первой попытки) или 1; листовка с первой попытки = 2.
import { h, rich, esc, shuffle } from './util.js';
import { modal, toast, onEsc } from './modal.js';
import { sound } from './sound.js';

// Вариант ответа: строка или { text, ok, why, partial }.
export const optText = (o) => (typeof o === 'string' ? o : o.text);

export class Progress {
  constructor(sc) {
    this.sc = sc;
    this.cards = new Set();
    this.shields = new Map(); // id → очки (1 или 2)
    this.rumors = new Map(); // id → { done, first, tries }
    this.facts = new Set();
    this.ach = new Set();
    this.bonus = new Map(); // id → очки (например, зарядка для глаз)
    this.before = null; // разминка этапа 1: { текст карточки: id корзины }
    this.onChange = null;
  }

  // Факты-голограммы живут в sc.life.facts (живой мир); sc.facts — запасной вариант.
  get factList() { return this.sc.life?.facts || this.sc.facts || []; }
  get cardsTotal() { return this.sc.cards.length; }
  get shieldsTotal() { return this.sc.shields.length; }
  get rumorsTotal() { return this.sc.rumors.length; }
  get rumorsDone() { return [...this.rumors.values()].filter((s) => s.done).length; }
  get rumorsFirst() { return [...this.rumors.values()].filter((s) => s.first).length; }
  get score() {
    let s = this.cards.size * 2 + this.rumorsFirst * 2;
    for (const p of this.shields.values()) s += p;
    for (const p of this.bonus.values()) s += p;
    return s;
  }
  get maxScore() { return (this.cardsTotal + this.shieldsTotal + this.rumorsTotal) * 2 + (this.sc.eyes?.bonus || 0); }

  // Бонус (один раз за id): очки + тост.
  giveBonus(id, pts, text) {
    if (this.bonus.has(id)) return false;
    this.bonus.set(id, pts);
    toast(`<b>Бонус +${pts}</b> · ${esc(text)}`, 'find', 3500, { html: true });
    this.onChange?.('bonus');
    return true;
  }

  // Сохранение для «Продолжить».
  toJSON() {
    return {
      cards: [...this.cards], shields: [...this.shields], rumors: [...this.rumors], facts: [...this.facts],
      ach: [...this.ach], bonus: [...this.bonus], before: this.before,
    };
  }
  load(s) {
    this.cards = new Set(s.cards); this.shields = new Map(s.shields); this.rumors = new Map(s.rumors);
    this.facts = new Set(s.facts); this.ach = new Set(s.ach); this.bonus = new Map(s.bonus); this.before = s.before ?? null;
  }

  rank() {
    for (const [min, title] of this.sc.ranks) if (this.score >= min) return title;
    return this.sc.ranks.at(-1)[1];
  }

  card(id) { return this.sc.cards.find((x) => x.id === id); }
  shield(id) { return this.sc.shields.find((x) => x.id === id); }

  giveCard(id, quiet = false) {
    if (this.cards.has(id)) return false;
    const c = this.card(id);
    if (!c) { console.warn('Нет карточки', id); return false; }
    this.cards.add(id);
    if (!quiet) {
      sound.play('star');
      toast(`<b>Карточка правды: ${esc(c.tag)}</b><br>${rich(c.text)}`, 'find', 4200, { html: true });
    }
    this.onChange?.('card');
    return true;
  }

  giveShield(id, points = 2) {
    if (this.shields.has(id)) return false;
    const s = this.shield(id);
    if (!s) { console.warn('Нет щита', id); return false; }
    this.shields.set(id, points);
    sound.play('shield');
    toast(`<div class="toast-shield">${s.icon ? `<img src="${s.icon}" alt="">` : ''}<div><b>Новый щит · ${esc(s.title)}</b><br>${points === 2 ? '+2 очка' : '+1 очко'}</div></div>`, 'shield', 3800, { html: true });
    this.onChange?.('shield');
    return true;
  }

  giveFact(id) {
    if (this.facts.has(id)) return false;
    this.facts.add(id);
    this.onChange?.('fact');
    if (this.factList.length && this.facts.size === this.factList.length) this.achieve('facts');
    return true;
  }

  achieve(id) {
    if (this.ach.has(id)) return false;
    const a = this.sc.achievements?.find((x) => x.id === id);
    if (!a) return false;
    this.ach.add(id);
    sound.play('fanfareShort');
    toast(`<div class="toast-medal"><span class="medal" style="--mc:${a.color || '#ffc53d'}">${a.icon || '★'}</span><div><b>Достижение!</b><br>${esc(a.title)}</div></div>`, 'medal', 3600, { html: true });
    this.onChange?.('ach');
    return true;
  }

  rumorState(id) { return this.rumors.get(id) || { done: false, first: false, tries: 0 }; }

  // Листовка Гоши: «Правда или слух?» — 4 варианта, после ошибки — почему этот вариант неверен.
  async askRumor(id) {
    const s = this.sc.rumors.find((x) => x.id === id);
    const st = { ...this.rumorState(id) };
    sound.play('paper');
    if (st.done) {
      await modal({ title: `«${s.text}»`, body: `**ПРОВЕРЕНО.** ${s.why}`, cls: 'rumor-modal' });
      return true;
    }
    return new Promise((resolve) => {
      const why = h('div', { class: 'fb' });
      const opts = h('div', { class: 'opts' });
      let finished = false;
      shuffle(s.options).forEach((o, k) => {
        const b = h('button', { class: 'opt', html: `<span class="opt-l">${'АБВГ'[k]}</span>${rich(optText(o))}` });
        b.onclick = () => {
          if (finished || b.disabled) return;
          st.tries++;
          if (o.ok) {
            finished = true;
            b.classList.add('ok');
            st.done = true;
            st.first = st.tries === 1;
            this.rumors.set(id, st);
            why.className = 'fb ok';
            why.innerHTML = (st.first ? '<b>Верно! +2 очка.</b> ' : '<b>Верно.</b> ') + rich(s.why);
            stamp.classList.remove('hidden');
            sound.play(st.first ? 'star' : 'good');
            this.onChange?.('rumor');
            if (this.rumorsDone === this.rumorsTotal) this.achieve('rumor');
            btn.textContent = 'Дальше';
            btn.classList.add('primary');
          } else {
            b.classList.add('bad');
            b.disabled = true;
            this.rumors.set(id, st);
            why.className = 'fb warn';
            why.innerHTML = '<b>Подумай:</b> ' + rich(o.why || 'это не так.');
            sound.play('bad');
          }
        };
        opts.append(b);
      });
      const stamp = h('div', { class: 'stamp small hidden' }, 'ПРОВЕРЕНО');
      const btn = h('button', { class: 'btn' }, 'Закрыть');
      const wrap = h('div', { class: 'overlay' },
        h('div', { class: 'modal rumor-modal' },
          h('div', { class: 'spot-place' }, `Листовка Гоши · ${s.place}`),
          h('div', { class: 'leaflet' }, h('b', {}, 'СЛУХ!'), h('div', { html: rich(s.text) }), stamp),
          h('h3', {}, 'Правда или слух?'),
          opts, why,
          h('div', { class: 'modal-btns' }, btn),
        ),
      );
      btn.onclick = () => {
        sound.play('click');
        wrap.remove();
        resolve(st.done);
      };
      document.getElementById('ui').append(wrap);
      onEsc(wrap, () => btn.onclick());
    });
  }

  // Блокнот корреспондента: вкладки «Карточки правды», «Щиты», «Энциклопедия».
  notebook(tab = 'cards') {
    const tabs = [
      ['cards', `Карточки правды · ${this.cards.size}/${this.cardsTotal}`],
      ['shields', `Щиты · ${this.shields.size}/${this.shieldsTotal}`],
    ];
    if (this.factList.length) tabs.push(['facts', `Энциклопедия · ${this.facts.size}/${this.factList.length}`]);
    const body = h('div', { class: 'nb-body' });
    const head = h('div', { class: 'nb-tabs' });
    const show = (t) => {
      head.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      body.replaceChildren(this._tab(t));
    };
    for (const [t, label] of tabs) head.append(h('button', { 'data-t': t, onclick: () => { show(t); sound.play('click'); } }, label));
    show(tab);
    return modal({ title: 'Блокнот корреспондента', body: h('div', {}, head, body), cls: 'wide' });
  }

  _tab(t) {
    if (t === 'cards') {
      return h('div', { class: 'board' }, this.sc.cards.map((f, i) => {
        const got = this.cards.has(f.id);
        return h('div', { class: 'fcard' + (got ? '' : ' locked') },
          h('div', { class: 'fcard-n' }, String(i + 1)),
          h('div', { class: 'fcard-tag' }, got ? f.tag : '???'),
          h('div', { class: 'fcard-text', html: got ? rich(f.text) : 'Ещё не найдено' }),
        );
      }));
    }
    if (t === 'shields') {
      return h('div', { class: 'board' }, this.sc.shields.map((s) => {
        const got = this.shields.has(s.id);
        return h('div', { class: 'shcard' + (got ? '' : ' locked') },
          s.icon && h('img', { src: s.icon, alt: '' }),
          h('div', {}, h('div', { class: 'fcard-tag' }, got ? s.title : '???'), h('div', { class: 'fcard-text', html: got ? rich(s.rule) : 'Щит ещё не получен' })),
        );
      }));
    }
    return h('div', { class: 'board' }, this.factList.map((f, i) => {
      const got = this.facts.has(f.id);
      return h('div', { class: 'fcard fact' + (got ? '' : ' locked') },
        got && f.img && h('img', { class: 'fact-img', src: f.img, alt: '' }),
        h('div', { class: 'fcard-tag' }, got ? f.title : `Факт ${i + 1}`),
        h('div', { class: 'fcard-text', html: got ? rich(f.text) : 'Найди голограмму «i» в школе' }),
      );
    }));
  }
}
