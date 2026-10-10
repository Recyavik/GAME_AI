// Общие детали виджетов: варианты ответа, обратная связь, кнопка «Дальше», макеты телефона и чата.
import { h, rich, shuffle } from '../util.js';
import { optText } from '../findings.js';

// Блок обратной связи. ok — зелёный, warn — жёлтое «Подумай: …», info — нейтральный.
export function feedback() {
  const el = h('div', { class: 'fb' });
  const set = (cls, html) => { el.className = 'fb ' + cls; el.innerHTML = html; };
  return {
    el,
    ok: (t) => set('ok', rich(t)),
    warn: (t) => set('warn', '<b>Подумай:</b> ' + rich(t)),
    info: (t) => set('info', rich(t)),
    clear: () => set('', ''),
  };
}

export function nextButton(api, text = 'Дальше', onClick) {
  return h('button', { class: 'btn primary hidden', onclick: () => (onClick ? onClick() : api.done()) }, text);
}

// Варианты ответа (перемешиваются). options: [{ text, ok, why, partial }].
// Неверный вариант: блокируется, «Подумай: why» (почему этот выбор опасен/неверен), api.mistake().
// partial — «почти»: объяснение без штрафа, вариант блокируется.
// Возвращает { el, fb } и вызывает onOk(option) при верном ответе.
export function optionList(options, api, onOk, { letters = true } = {}) {
  const fb = feedback();
  let solved = false;
  const list = h('div', { class: 'opts' });
  shuffle(options).forEach((o, k) => {
    const b = h('button', { class: 'opt', html: (letters ? `<span class="opt-l">${'АБВГД'[k]}</span>` : '') + rich(optText(o)) });
    b.onclick = () => {
      if (solved || b.disabled) return;
      if (o.ok) {
        solved = true;
        b.classList.add('ok');
        list.querySelectorAll('.opt').forEach((x) => { if (x !== b) x.disabled = true; });
        fb.ok(o.why || 'Верно!');
        api.sound.play('good');
        onOk?.(o);
      } else {
        b.classList.add(o.partial ? 'partial' : 'bad');
        b.disabled = true;
        if (o.partial) fb.info('**Почти.** ' + (o.why || ''));
        else { fb.warn(o.why || 'этот вариант не подходит.'); api.mistake(); }
        api.sound.play(o.partial ? 'click' : 'bad');
      }
    };
    list.append(b);
  });
  return { el: h('div', {}, list, fb.el), fb };
}

// Макет телефона (рисуется кодом). top — шапка (узел или текст).
export function phone(top, ...body) {
  return h('div', { class: 'mock-phone' },
    h('div', { class: 'mp-notch' }),
    top && h('div', { class: 'mp-top' }, top),
    h('div', { class: 'mp-screen' }, ...body),
  );
}

// Аватар: картинка или кружок с буквой.
export function avatar(img, name = '?', cls = 'ava') {
  return img ? h('img', { class: cls, src: img, alt: '' }) : h('span', { class: cls + ' letter' }, (name || '?')[0]);
}

// Пузырь чата.
export function bubble(side, html, { name, img, time, cls = '' } = {}) {
  return h('div', { class: `msg ${side} ${cls}` },
    side !== 'note' && side !== 'me' && avatar(img, name, 'chat-ava'),
    h('div', { class: 'bubble' },
      name && side !== 'me' && h('div', { class: 'msg-name' }, name),
      h('div', { class: 'msg-text', html }),
      time && h('div', { class: 'msg-time' }, time),
    ),
  );
}

export function svgEl(markup, cls = '') {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = markup;
  return d;
}

// Перетаскивание карточки указателем (мышь, палец, перо). Короткое нажатие без движения — tap().
// zones: { id: элемент }. drop(id) — карточку бросили на зону. Отмена касания (второй палец, ладонь
// на доске) и закрытие окна (cancelDrag) убирают «призрак» и слушатели.
let activeDrag = null;
export function dragCard(e, cardEl, zones, { drop, tap }) {
  cancelDrag();
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let ghost = null;
  const zoneAt = (x, y) => {
    const under = document.elementFromPoint(x, y);
    return Object.keys(zones).find((id) => zones[id].contains(under));
  };
  const light = (id) => { for (const [k, z] of Object.entries(zones)) z.classList.toggle('over', k === id); };
  const stop = () => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', stop);
    cardEl.classList.remove('dragging');
    light(null);
    ghost?.remove();
    activeDrag = null;
  };
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
      ghost = cardEl.cloneNode(true);
      ghost.classList.add('ghost');
      ghost.style.width = cardEl.offsetWidth + 'px';
      document.body.append(ghost);
      cardEl.classList.add('dragging');
    }
    if (ghost) {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      light(zoneAt(ev.clientX, ev.clientY));
    }
  };
  const up = (ev) => {
    const dragged = !!ghost;
    const id = dragged ? zoneAt(ev.clientX, ev.clientY) : null;
    stop();
    if (!dragged) tap?.();
    else if (id) drop(id);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', stop);
  activeDrag = stop;
}
export function cancelDrag() { activeDrag?.(); }

// Маленькая пауза для «живости» анимаций.
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
