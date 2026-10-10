// Диалоги с портретами: печать текста, пробел/клик — дальше.
// Реплика: ['vera', 'Текст'] или ['filya:happy', 'Текст'] (эмоция портрета).
// Особые говорящие: 'me' — герой; '' или 'note' — без портрета (пояснение).
import { h, rich } from './util.js';
import { sound } from './sound.js';

export class Dialog {
  constructor(cast) {
    this.cast = cast;
    this.el = h('div', { class: 'dialog hidden' });
    document.getElementById('ui').append(this.el);
    this.cancelFn = null;
    this.onSpeaker = null; // (id) => void — например, повернуть NPC к игроку
  }

  portrait(who) {
    const [id, emo = 'normal'] = who.split(':');
    const c = this.cast[id];
    if (!c) return { id, name: '', img: null };
    const p = c.portrait;
    const img = typeof p === 'string' ? p : p ? p[emo] || p.normal || Object.values(p)[0] : null;
    return { id, name: c.name, img, color: c.color };
  }

  play(lines) {
    if (!lines || !lines.length) return Promise.resolve();
    return new Promise((resolve) => {
      let i = -1;
      let typing = null;
      let full = '';
      const textEl = h('div', { class: 'dlg-text' });
      const nameEl = h('div', { class: 'dlg-name' });
      const imgEl = h('div', { class: 'dlg-portrait' });
      const hint = h('div', { class: 'dlg-hint' }, 'Пробел или клик — дальше');
      this.el.replaceChildren(imgEl, h('div', { class: 'dlg-main' }, nameEl, textEl, hint));
      this.el.classList.remove('hidden');

      const finish = () => {
        clearInterval(typing);
        typing = null;
        textEl.innerHTML = full;
      };
      const next = () => {
        if (typing) return finish();
        i++;
        if (i >= lines.length) return end();
        const line = Array.isArray(lines[i]) ? { who: lines[i][0], text: lines[i][1] } : lines[i];
        const p = this.portrait(line.who || '');
        this.onSpeaker?.(p.id);
        if (/^owl/.test(line.who || '')) sound.play('ai', 0.6); // «голос» Совёнка
        this.el.classList.toggle('me', p.id === 'me');
        this.el.classList.toggle('note', !p.name);
        nameEl.textContent = p.name || '';
        imgEl.replaceChildren(p.img ? h('img', { src: p.img, alt: p.name }) : h('span', {}, p.name ? p.name[0] : 'ℹ'));
        imgEl.style.display = p.name ? '' : 'none';
        full = rich(line.text);
        // Печать по символам (по видимому тексту, теги вставляем целиком).
        const tokens = full.match(/<[^>]+>|&[a-z#0-9]+;|./gsu) || [];
        let k = 0;
        textEl.innerHTML = '';
        typing = setInterval(() => {
          k += 2;
          textEl.innerHTML = tokens.slice(0, k).join('');
          if (k % 6 === 0) sound.play('blip');
          if (k >= tokens.length) finish();
        }, 22);
      };
      const end = () => {
        cleanup();
        this.el.classList.add('hidden');
        resolve();
      };
      const onKey = (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          if (document.querySelector('.overlay')) return;
          e.preventDefault();
          next();
        }
      };
      const onClick = () => next();
      const cleanup = () => {
        clearInterval(typing);
        document.removeEventListener('keydown', onKey);
        this.el.removeEventListener('click', onClick);
        this.cancelFn = null;
      };
      document.addEventListener('keydown', onKey);
      this.el.addEventListener('click', onClick);
      this.cancelFn = () => { cleanup(); this.el.classList.add('hidden'); resolve(); };
      next();
    });
  }

  get active() { return !!this.cancelFn; }
}
