// incoming-call — входящий звонок поддельным голосом, СМС с кодом, выбор действия.
// data: {
//   caller, number, voice: '«Привет, это мама!…»', sms,
//   clip?: запись звонка, callbackClip?: { f, m } — запись ответа мамы (по полу героя),
//   q, options: [{ text, ok, why, partial }], callback: 'реплика при перезвоне', next?
// }
import { h, rich, heroFemale } from '../util.js';
import { optionList, phone, wait } from './kit.js';
import { speak, stopSpeech } from '../speech.js';

const PHONE = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';

export default function incomingCall(el, d, api) {
  const screen = h('div', { class: 'call-screen' });
  const side = h('div', { class: 'w-col' });
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  let ringing = true;
  let alive = true; // окно закрыли посреди звонка — дальше ничего не звучит

  const ringLoop = async () => {
    while (ringing) { api.sound.play('ring'); await wait(1300); }
  };

  // 1. Звонок.
  const answerBtn = h('button', { class: 'call-btn green', html: PHONE, title: 'Ответить' });
  const declineBtn = h('button', { class: 'call-btn red', disabled: true, html: PHONE });
  screen.append(
    h('div', { class: 'call-who' }, h('span', { class: 'call-ava' }, '?'), h('b', {}, d.caller), h('span', {}, d.number)),
    h('div', { class: 'call-state' }, 'входящий звонок…'),
    h('div', { class: 'call-btns' }, declineBtn, answerBtn),
  );
  side.append(h('p', { class: 'w-intro' }, 'Звонит телефон! Ответь.'));
  ringLoop();

  answerBtn.onclick = async () => {
    ringing = false;
    answerBtn.disabled = true;
    screen.querySelector('.call-state').textContent = 'идёт разговор 00:03';
    const bubble = h('div', { class: 'call-bubble' });
    side.replaceChildren(bubble);
    // Текст «печатается», параллельно звучит синтезированный голос (если есть).
    const text = d.voice;
    const talk = d.clip
      ? api.sound.clip(d.clip).then((ok) => ok || speak(text.replace(/[«»]/g, ''), { gender: 'f', pitch: 1.05, rate: 1.08 }))
      : speak(text.replace(/[«»]/g, ''), { gender: 'f', pitch: 1.05, rate: 1.08 });
    for (let i = 0; i <= text.length; i += 2) { if (!alive) return; bubble.textContent = text.slice(0, i); await wait(28); }
    await talk;
    if (!alive) return;
    // 2. СМС с кодом.
    screen.append(h('div', { class: 'sms' }, h('b', {}, 'СМС'), h('div', { html: rich(d.sms) })));
    api.sound.play('ding');
    const { el: list } = optionList(d.options, api, async () => {
      stopSpeech();
      api.sound.stopClip();
      // Подозрительный звонок завершён…
      screen.querySelector('.call-state').textContent = 'звонок завершён';
      screen.querySelector('.call-btns')?.remove();
      await wait(900);
      if (!alive) return;
      // …и игрок сам звонит маме по номеру из своих контактов.
      const state = h('div', { class: 'call-state' }, 'вызов…');
      screen.replaceChildren(
        h('div', { class: 'call-who' }, h('span', { class: 'call-ava mom' }, 'М'), h('b', {}, d.callbackName || 'Мама'), h('span', {}, 'мой контакт · исходящий')),
        state,
      );
      for (let i = 0; i < 2; i++) { if (!alive) return; api.sound.play('beep'); await wait(800); }
      if (!alive) return;
      state.textContent = 'идёт разговор 00:02';
      screen.append(h('div', { class: 'call-back' }, h('b', {}, d.callbackName || 'Мама'), h('div', { html: rich(d.callback) })));
      api.sound.play('pop');
      const back = d.callbackClip?.[heroFemale() ? 'f' : 'm'];
      if (back) await api.sound.clip(back);
      if (!alive) return;
      next.classList.remove('hidden');
    });
    side.append(h('h3', { class: 'w-q', html: rich(d.q) }), list, h('div', { class: 'w-actions' }, next));
  };

  el.append(h('div', { class: 'w-two' }, phone(null, screen), side));
  return () => { alive = false; ringing = false; stopSpeech(); api.sound.stopClip(); };
}
