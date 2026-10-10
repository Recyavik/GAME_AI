// voice-command — «Поймай ослышку»: колонка распознаёт фразы при разном шуме.
// data: {
//   intro, speaker: 'Бусинка', need: 2,
//   noise: ['Тишина', 'Столовая', 'Перемена'],
//   beds?: [null, { clip, vol }, …] — запись шума для каждого уровня (голос звучит внутри шума),
//   phrases: [{ say, clip?: запись фразы или { m, f } — голос по полу героя (фразу говорит сам игрок), heard: ['…тишина', '…столовая', '…перемена'] }],
//   success, next?
// }
// Ученик выбирает шум и фразу, слушает, что «услышала» колонка, и решает: верно или ослышалась.
import { h, rich, esc, heroFemale } from '../util.js';
import { feedback } from './kit.js';
import { speak, stopSpeech } from '../speech.js';

export default function voiceCommand(el, d, api) {
  const fb = feedback();
  const next = h('button', { class: 'btn primary hidden', onclick: () => api.done() }, d.next || 'Дальше');
  let noise = 0;
  let current = null;
  const found = new Set();
  const counter = h('div', { class: 'vc-count' });
  const heardEl = h('div', { class: 'vc-heard' }, `${d.speaker} ждёт команду…`);
  const wave = h('div', { class: 'vc-wave' }, ...Array.from({ length: 24 }, () => h('i')));
  const judge = h('div', { class: 'vc-judge hidden' });
  const upd = () => { counter.textContent = `Ослышки найдены: ${found.size} из ${d.need}`; };
  upd();

  const seg = h('div', { class: 'seg big' });
  d.noise.forEach((n, i) => {
    const b = h('button', { class: i === 0 ? 'on' : '' }, n);
    b.onclick = () => {
      if (busy) return;
      noise = i;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      wave.style.setProperty('--noise', String(i));
      api.sound.play('click');
    };
    seg.append(b);
  });

  const phrases = h('div', { class: 'vc-phrases' }, d.phrases.map((p, i) => {
    const b = h('button', { class: 'chip' }, `«${p.say}»`);
    b.onclick = () => { if (!busy) say(i); };
    return b;
  }));

  let alive = true;
  let busy = false; // пока фраза звучит, другую не начинаем и шум не меняем
  async function say(i) {
    busy = true;
    el.classList.add('vc-busy');
    const p = d.phrases[i];
    const heard = p.heard[noise];
    current = { i, heard, wrong: heard !== p.say, key: `${i}:${heard}` };
    wave.classList.add('on');
    heardEl.textContent = 'Слушаю…';
    judge.classList.add('hidden');
    // Запись голоса с подмешанным шумом; без записи — синтез речи.
    const clip = typeof p.clip === 'object' ? p.clip?.[heroFemale() ? 'f' : 'm'] : p.clip;
    const bed = d.beds?.[noise];
    if (!clip || !(await api.sound.clip(clip, bed ? { bed: bed.clip, bedVol: bed.vol } : {}))) await speak(p.say, { gender: heroFemale() ? 'f' : 'm', rate: 1 });
    wave.classList.remove('on');
    if (!alive) return;
    busy = false;
    el.classList.remove('vc-busy');
    heardEl.innerHTML = `${esc(d.speaker)} услышала: <b>«${esc(heard)}»</b>`;
    api.sound.play('beep');
    judge.classList.remove('hidden');
  }

  const ok = h('button', { class: 'btn' }, 'Поняла верно');
  const bad = h('button', { class: 'btn warn' }, 'Ослышалась!');
  judge.append(ok, bad);
  const answer = (saysWrong) => {
    if (!current) return;
    judge.classList.add('hidden');
    if (saysWrong === current.wrong) {
      api.sound.play('good');
      if (current.wrong && !found.has(current.key)) {
        found.add(current.key);
        upd();
        fb.ok('Точно, ослышка! Шум сбивает распознавание.');
      } else if (current.wrong) fb.ok('Эту ослышку ты уже {нашёл|нашла}. Ищи другую.');
      else fb.ok('Верно, колонка поняла правильно.');
      if (found.size >= d.need) { fb.ok(d.success); next.classList.remove('hidden'); }
    } else {
      api.sound.play('bad');
      fb.warn(current.wrong ? 'сравни слово в слово: так ли была сказана фраза?' : 'колонка услышала ровно то, что было сказано.');
    }
    current = null;
  };
  ok.onclick = () => answer(false);
  bad.onclick = () => answer(true);

  el.append(
    h('div', { class: 'w-voice' },
      d.intro && h('p', { class: 'w-intro', html: rich(d.intro) }),
      h('div', { class: 'vc-top' }, speakerSvg(), h('div', { class: 'w-col' }, h('div', { class: 'vc-label' }, 'Шум вокруг:'), seg, wave, heardEl, judge)),
      h('div', { class: 'vc-label' }, 'Скажи колонке:'), phrases,
      counter, fb.el,
      h('div', { class: 'w-actions' }, next),
    ),
  );
  return () => { alive = false; api.sound.stopClip(); stopSpeech(); };
}

export function speakerSvg() {
  const d = document.createElement('div');
  d.className = 'vc-speaker';
  d.innerHTML = '<svg viewBox="0 0 100 120"><rect x="15" y="20" width="70" height="90" rx="30" fill="#e8ebf5"/><rect x="15" y="20" width="70" height="20" rx="10" fill="#7c6bff"/><circle cx="50" cy="75" r="22" fill="#cfd5e6"/><circle cx="50" cy="75" r="12" fill="#b4bcd4"/><circle cx="36" cy="30" r="3" fill="#bdf"/><circle cx="50" cy="30" r="3" fill="#bdf"/><circle cx="64" cy="30" r="3" fill="#bdf"/></svg>';
  return d;
}
