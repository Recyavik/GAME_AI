// badge-enroll — оформление документа с фото: пропуск в Лабораторию ИИ, читательский билет и т. п.
// Методически важно: СНАЧАЛА спрашиваем согласие, потом снимаем (так и должно быть с биометрией).
// Снимок — квадратное фото на пропуск (голова и плечи); на нём проступают 5 точек распознавания.
// data: { ask, yes, no, whyConsent, saved, codeText, card?: { title, sub } (карточка в углу экрана),
//         store?: false (не писать в ctx.state), achieve?: id достижения за любой честный ответ, next? }
// Пишет в ctx.state: consent (true/false), code ('4827' и т. п.). Вызывает ctx.onBadge(card).
import { h, rich } from '../util.js';
import { feedback, wait } from './kit.js';
import { liveCam, passPhoto } from './face-photo.js';

export default function badgeEnroll(el, d, api) {
  const ctx = api.ctx;
  const fb = feedback();
  let alive = true; // окно закрыли во время съёмки — документ не выдаём
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Получить пропуск');
  const shot = h('button', { class: 'btn primary big hidden' }, 'Сделать снимок');
  const view = h('div', { class: 'be-view' }, liveCam(ctx.hero));
  const side = h('div', { class: 'w-col' });
  el.append(h('div', { class: 'w-two' }, view, side));

  const yes = h('button', { class: 'opt' }, d.yes);
  const no = h('button', { class: 'opt' }, d.no);
  side.append(
    h('h3', { class: 'w-q', html: rich(d.ask) }),
    h('div', { class: 'opts' }, yes, no),
    h('div', { class: 'w-actions left' }, shot),
    fb.el,
    h('div', { class: 'w-actions' }, next),
  );

  yes.onclick = () => {
    if (d.store !== false) ctx.state.consent = true;
    yes.classList.add('ok'); no.disabled = true; yes.disabled = true;
    fb.ok(d.whyConsent + '\nТеперь сделай снимок: камера возьмёт только квадрат в рамке.');
    shot.classList.remove('hidden');
    shot.focus();
  };
  no.onclick = () => {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (d.store !== false) { ctx.state.consent = false; ctx.state.code = code; }
    no.classList.add('ok'); yes.disabled = true; no.disabled = true;
    fb.ok(d.whyConsent + '\n' + d.codeText.replace('{code}', code));
    api.sound.play('good');
    done(true);
  };

  shot.onclick = async () => {
    shot.disabled = true;
    api.sound.play('shutter');
    view.classList.add('flash');
    await wait(350);
    if (!alive) return;
    view.classList.remove('flash');
    shot.classList.add('hidden');
    // Вместо камеры — квадратное фото на пропуск, на нём по одной проступают точки.
    const photo = passPhoto(ctx.hero, { dots: 'animate', onDot: () => api.sound.play('pop', 0.6) });
    view.replaceChildren(photo);
    api.sound.play('scan');
    await photo.ready;
    if (!alive) return;
    photo.classList.add('scanned');
    fb.ok(d.saved);
    api.sound.play('star');
    done();
  };

  const done = (noPhoto = false) => {
    ctx.onBadge?.({ ...d.card, noPhoto });
    if (d.achieve) ctx.progress.achieve(d.achieve);
    next.classList.remove('hidden');
  };
  return () => { alive = false; };
}
