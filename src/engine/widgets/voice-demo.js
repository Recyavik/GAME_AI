// voice-demo — «ИИ умеет говорить чужим голосом»: два голоса, угадай, какой настоящий.
// Честная развязка: оба сделал компьютер — на слух отличить трудно.
// data: { intro, phrase, who: 'Артём', clips?: [запись1, запись2] (порядок А/Б случайный), q, reveal, next? }
import { h, rich } from '../util.js';
import { feedback } from './kit.js';
import { speak, stopSpeech } from '../speech.js';
import { speakerSvg } from './voice-command.js';

export default function voiceDemo(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  const heard = new Set();
  const clips = d.clips?.length === 2 ? (Math.random() < 0.5 ? [...d.clips] : [d.clips[1], d.clips[0]]) : null;
  let alive = true;
  let busy = false; // пока звучит один голос, второй не запускаем
  const play = (k, opts) => async () => {
    if (busy) return;
    busy = true;
    btns[k].classList.add('playing');
    if (!clips || !(await api.sound.clip(clips[k]))) await speak(d.phrase, opts);
    if (!alive) return;
    btns[k].classList.remove('playing');
    busy = false;
    heard.add(k);
    if (heard.size === 2) pick.classList.remove('hidden');
  };
  const btns = [
    h('button', { class: 'btn big', onclick: () => play(0, { gender: 'm', pitch: 0.95, rate: 1 })() }, '▶ Голос А'),
    h('button', { class: 'btn big', onclick: () => play(1, { gender: 'm', voiceIndex: 1, pitch: 0.9, rate: 1.05 })() }, '▶ Голос Б'),
  ];
  const answer = () => {
    pick.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    api.sound.play('star');
    fb.ok(d.reveal);
    next.classList.remove('hidden');
  };
  const pick = h('div', { class: 'hidden' },
    h('h3', { class: 'w-q', html: rich(d.q) }),
    h('div', { class: 'opts row' },
      h('button', { class: 'opt', onclick: answer }, `Голос А — настоящий ${d.who || 'человек'}`),
      h('button', { class: 'opt', onclick: answer }, `Голос Б — настоящий ${d.who || 'человек'}`),
    ),
  );
  fb.info('Послушай оба голоса.');
  el.append(
    h('div', { class: 'w-two' },
      speakerSvg(),
      h('div', { class: 'w-col' },
        d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }),
        h('div', { class: 'vd-phrase' }, `«${d.phrase}»`),
        h('div', { class: 'w-actions left' }, ...btns),
        pick, fb.el,
        h('div', { class: 'w-actions' }, next),
      ),
    ),
  );
  return () => { alive = false; api.sound.stopClip(); stopSpeech(); };
}
