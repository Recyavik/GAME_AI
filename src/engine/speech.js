// Озвучка через speechSynthesis. Голоса берутся из системы:
//  • «естественные» (Natural/Neural/Online) — есть в Microsoft Edge, звучат почти как живой человек,
//    но работают только при интернете; без сети игра сама переходит на обычные голоса;
//  • голоса Windows (Irina, Pavel и др.) — работают офлайн, звучат проще.
// Если русского голоса нет совсем — speak() просто ждёт время «чтения», а виджет показывает текст.
let voices = [];
function load() {
  try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; }
}
load();
try { window.speechSynthesis?.addEventListener?.('voiceschanged', load); } catch { /* нет синтеза */ }

const FEMALE = /irina|svetlana|dariya|ekaterina|elena|anna|milena|google|женск|female/i;
const MALE = /pavel|dmitry|dmitri|yuri|maxim|мужск|male/i;

function hasVoice() {
  load();
  return voices.some((v) => /^ru/i.test(v.lang));
}

// Лучший русский голос нужного пола: естественные (онлайн) выше, если есть сеть.
function pick(gender, avoid) {
  const ru = voices.filter((v) => /^ru/i.test(v.lang));
  const online = navigator.onLine !== false;
  const score = (v) => {
    let s = 0;
    if (/natural|neural/i.test(v.name)) s += online ? 6 : -6;
    else if (!v.localService) s += online ? 3 : -6;
    if (gender === 'f' && FEMALE.test(v.name)) s += 4;
    if (gender === 'm' && MALE.test(v.name)) s += 4;
    if (gender === 'f' && MALE.test(v.name)) s -= 4;
    if (gender === 'm' && FEMALE.test(v.name)) s -= 4;
    if (avoid && v.name === avoid.name) s -= 3;
    return s;
  };
  return ru.sort((a, b) => score(b) - score(a))[0];
}

// gender: 'f' | 'm'; pitch/rate — лёгкая подстройка (демонстрация «поддельного голоса», не клонирование).
// voiceIndex: 0 — лучший голос, 1 — другой голос того же пола (для «какой голос настоящий?»).
export function speak(text, { pitch = 1, rate = 1, gender = 'f', voiceIndex = 0 } = {}) {
  return new Promise((resolve) => {
    const fallback = () => setTimeout(resolve, Math.min(6000, 600 + text.length * 45));
    if (!hasVoice()) return fallback();
    try {
      const first = pick(gender);
      const v = voiceIndex ? pick(gender, first) || first : first;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v?.lang || 'ru-RU';
      u.pitch = pitch;
      u.rate = rate;
      let done = false;
      const end = () => { if (!done) { done = true; resolve(); } };
      u.onend = end;
      u.onerror = end;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setTimeout(end, 14000); // страховка
    } catch {
      fallback();
    }
  });
}

export function stopSpeech() {
  try { window.speechSynthesis?.cancel(); } catch { /* ничего */ }
}
